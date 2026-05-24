/**
 *  This file contains the main logic for the store pages, including fetching data, rendering products, and handling user interactions. It relies on the API functions defined in global.js to communicate with the backend server.
*/

// checks user credentials saved in the local storage if not return to Login page
setUpUser();

const dashboardRoutes = {
  Home:             '/store/home.html',
  Browse:           '/store/browse.html',
  Cart:             '/store/cart.html',
  Order:            '/store/order.html',
  Business:         '/store/business.html'
};

let selectedProductId = null;
const shippingCost = 5.0;

// create the deals/discount cards (by 3s)
async function createDealCard(category, items=null, index=0) {
	
	let discountedItems = items;
	const toShow = discountedItems.slice(index, index + 3);

	let toAdd = '';
	toShow.forEach((product) => {
		let discountText = "";
		if (product.product_discount > 0) {
			discountText = `
			<div class="deal-card-discount"></div>
			<div class="discount-text">-${parseFloat(product.product_discount)}%</div>
			`;
		}

		const hasImage = product.product_image && product.product_image !== '/img/home-image.png' && product.product_image.trim() !== '';
		const imageSource = hasImage ? product.product_image : '/img/home-image.png';
		const noImageClass = !hasImage ? 'no-image' : '';
		const gradientContent = '';
		
		const priceText = product.product_discount > 0 ? `₱${formatPrice(product.product_price * (1 - product.product_discount / 100))} <s>₱${formatPrice(product.product_price)}</s>` : `₱${formatPrice(product.product_price)}`;

		toAdd += 
		`<div class="deal-card" data-product-id="${product.product_id}" data-product-image="${imageSource}" data-product-price="${product.product_price}" data-product-discount="${product.product_discount || 0}" data-product-stock="${product.product_stock || 0}">
			<div class="deal-card-container ${noImageClass}" style="background-image: url('${imageSource}');">
				<div class="deal-card-gradient">${gradientContent}</div>
			</div>
			<div class="deal-card-details">
				<div class="detail-sample1">${product.product_name}</div>
				<div class="detail-sample2">${product.product_description}</div>
			</div>
			<div class="deal-price">${priceText}</div>
			${discountText}
		</div>`;
	});

	for (let i = toShow.length; i < 3; i++) {
		toAdd += `<div class="deal-card"></div>`;
	}
	document.querySelector('.deal-card-group').innerHTML = toAdd;
	document.querySelector('.home-deals .category-chosen').style.right = `calc(105px + 120px * ${category.place})`;
}

// create common item cards
function createItemCard(products, category) {
	if (category.name != "All") {
		products = products.filter((product) => product.product_type == category.name);
	}

	let toAdd = '';
	products.forEach((product) => {
		let discountText = "";
		if (product.product_discount > 0) {
			discountText = `
				<div class="item-discount"></div>
				<div class="item-discount-text">-${parseFloat(product.product_discount)}%</div>`;
		}

		const hasImage = product.product_image && product.product_image !== '/img/home-image.png' && product.product_image.trim() !== '';
		const imageSource = hasImage ? product.product_image : '/img/home-image.png';
		const noImageClass = !hasImage ? 'no-image' : '';
		const gradientContent = !hasImage ? '📷' : '';
		
		const priceText = product.product_discount > 0 ? `₱${formatPrice(product.product_price * (1 - product.product_discount / 100))} <s>₱${formatPrice(product.product_price)}</s>` : `₱${formatPrice(product.product_price)}`;

		toAdd += `
		<div class="item-card" data-product-id="${product.product_id}" data-product-image="${imageSource}" data-product-price="${product.product_price}" data-product-discount="${product.product_discount || 0}" data-product-stock="${product.product_stock || 0}">
			<div class="item-card-container ${noImageClass}" style="background-image: url('${imageSource}');">
				<div class="item-card-gradient">${gradientContent}</div>
			</div>
			${discountText}
			<div class="item-card-details">
				<div class="item-price">${priceText}</div>
				<div class="item-detail1">${product.product_name}</div>
				<div class="item-detail2">${product.product_description}</div>
			</div>
		</div>`
	});
	document.querySelector('.item-card-group').innerHTML = toAdd;
	const categoryButton = document.querySelector('.home-items .category-chosen');
	if (categoryButton) {
		categoryButton.style.right = `calc(105px + 120px * ${category.place})`;
	}
}

// create modal for add to cart
async function addToCartItem(productId, quantity = 1, options = {}) {
	if (!productId) {
		alert('Unable to add item to cart: missing product ID.');
		return null;
	}

	if (quantity < 1) {
		alert('Quantity must be at least 1.');
		return null;
	}

	try {
		const result = await addToCart(productId, quantity);
		alert(`Added ${quantity} item${quantity > 1 ? 's' : ''} to cart`);
		if (options.closeModal) {
			const overlay = document.querySelector('.card-modal-overlay');
			if (overlay) {
				overlay.hidden = true;
				document.body.style.overflow = '';
			}
		}
		if (options.goToCart) {
			window.location.href = dashboardRoutes.Cart;
		}
		return result;
	} catch (err) {
		console.error('Add to cart failed:', err);
		alert('Could not add item to cart.');
		return null;
	}
}

// create category buttons
function createCategories(place, categories) {
	let toAdd = '';
	categories.forEach((category) => {
		toAdd += `<div class="category-choice">${category.name}</div>`;
	});
	document.querySelector(`${place}`).innerHTML = toAdd + `<div class="category-chosen"></div>`;
}




if (document.body.id === 'store-home') {
	async function changeDealCategory(category) {
		// Get products and create categories based on number of discounted products, then show the correct category
		const discounted = await discountedProducts();
		const n = Math.ceil(discounted.length / 3);
		const numberCategory = Array.from({ length: n }, (_, i) => i + 1);
		const categories = categoryAddPlace(numberCategory);
		createCategories('.home-deals .category-selection', categories);

		// Create deal cards for the category
		const specificCategory = categories.find((cat) => cat.name == category);
		const index = (category - 1) * 3;
		await createDealCard(specificCategory, discounted, index);
	}

	// change the category of the items shown
	async function changeItemCategory(category) {
		let categories = await getCategories();
		categories.unshift({name: "All", place: categories[0].place + 1});
		createCategories('.home-items .category-selection', categories);
		const specificCategory = categories.find((cat) => cat.name == category);

		let products = await popularProducts();
		await createItemCard(products, specificCategory);
	}

	// Initialize the page
	async function initializeStoreHome() {
		await changeDealCategory('1');
		await changeItemCategory('All');

		// Add event delegation for deal categories
		document.querySelector('.home-deals .category-selection').addEventListener('click', (e) => {
			if (e.target.classList.contains('category-choice')) {
				changeDealCategory(e.target.textContent.trim());
			}
		});

		// Add event delegation for item categories
		document.querySelector('.home-items .category-selection').addEventListener('click', (e) => {
			if (e.target.classList.contains('category-choice')) {
				changeItemCategory(e.target.textContent.trim());
			}
		});
	}

	initializeStoreHome();
}

else if (document.body.id === 'store-browse') {
	let browseProducts = [];
	let currentBrowseCategory = 'All';
	let currentBrowseSearch = '';
	let categories = [];

	async function applyBrowseCategoryMarker(category) {
		const categoryObj = categories.find((cat) => cat.name === category);
		
		document.querySelector('.home-deals .category-chosen').style.right = `calc(105px + 120px * ${categoryObj.place})`;
	}

	async function refreshBrowseDisplay() {
		createCategories('.home-deals .category-selection', categories);
		browseProducts = await loadProducts();

		let products = browseProducts;
		if (currentBrowseCategory !== 'All') {
			products = products.filter((product) => product.product_type === currentBrowseCategory);
		}

		const search = currentBrowseSearch.trim().toLowerCase();
		if (search) {
			products = products.filter((product) => {
				return product.product_name.toLowerCase().includes(search) ||
					String(product.productId).includes(search);
			});
		}

		const dealCards = products.slice(0, 3);
		createDealCard(currentBrowseCategory, dealCards);
		createItemCard(products.slice(3), {name: currentBrowseCategory});
		applyBrowseCategoryMarker(currentBrowseCategory);
	}

	async function changeCategory(category) {
		currentBrowseCategory = category;
		await refreshBrowseDisplay();
	}


	async function initializeStoreBrowse() {
		categories = await getCategories();
		categories.unshift({name: "All", place: categories[0].place + 1});
		await changeCategory('All');

		// Add event delegation for the search bar
		const searchBar = document.querySelector('.search-bar');
		if (searchBar) {
			searchBar.addEventListener('input', (event) => {
				currentBrowseSearch = event.target.value || '';
				refreshBrowseDisplay();
			});
		}

		// Add event delegation for the categories
		document.querySelector('.category-selection').addEventListener('click', (e) => {
			if (e.target.classList.contains('category-choice')) {
				changeCategory(e.target.textContent.trim());
			}
		});
	}

	initializeStoreBrowse();
}

else if (document.body.id === 'store-cart') {
	async function createCartTable(){
		const userCart = await getCart();

		let rowsHtml = '';
		userCart.forEach((product) => {

			rowsHtml += `
			<tr class="cart-item" data-product-id="${product.product_id}" data-unit-price="${product.product_price}" data-unit-discount="${product.product_discount || 0}" data-stock="${product.product_stock || 0}">
				<td class="text-center">
					<input type="number" class="cart-qty" min="1" value="${product.item_quantity}"/>
				</td>
				<td class="product-cell">
					<img class="product-thumb" src="${product.product_image}" alt="${product.product_name}" />
					<div>
						<div class="product-name">${product.product_name}</div>
						<div class="stock-warning" style="color:#d32f2f;font-size:0.85rem;margin-top:4px;display:none;"></div>
					</div>
				</td>
				<td>${product.product_description}</td>
				<td class="product-price text-center"></td>
				<td class="text-center"><button type="button" class="remove-row">Delete</button></td>
			</tr>`
		});
		document.querySelector(".table-body").innerHTML = rowsHtml;
	}

	function formatPrice(value) {
		return `₱${value.toFixed(2)}`;
	}

	function getCartRows() {
		return Array.from(document.querySelectorAll('.cart-item'));
	}

	function updateTotals() {
		const rows = getCartRows();
		let subtotal = 0;
		let discountTotal = 0;

		rows.forEach(row => {
			const qtyInput = row.querySelector('.cart-qty');
			let qty = Math.max(1, Number(qtyInput.value) || 1);
			const stock = Number(row.dataset.stock) || 0;
			const warningEl = row.querySelector('.stock-warning');

			if (stock > 0 && qty > stock) {
				warningEl.textContent = `Only ${stock} in stock.`;
				warningEl.style.display = 'block';
				qty = stock;
				qtyInput.value = qty;
			} else {
				warningEl.textContent = '';
				warningEl.style.display = 'none';
			}

			const unitPrice = Number(row.dataset.unitPrice) || 0;
			const unitDiscount = Number(row.dataset.unitDiscount) || 0;
			const lineTotal = qty * unitPrice;
			row.querySelector('.product-price').textContent = formatPrice(lineTotal);

			discountTotal += (unitPrice * qty) * ((unitDiscount) / 100);
			subtotal += lineTotal;
		});

		const shipping = rows.length ? shippingCost : 0;
		const total = subtotal - discountTotal + shipping;

		if (rows.length > 0) {
			document.querySelector('.subtotal-value').textContent = formatPrice(subtotal);
			document.querySelector('.discount-value').textContent = `-${formatPrice(discountTotal)}`;
			document.querySelector('.shipping-value').textContent = formatPrice(shipping);
			document.querySelector('.total-value').textContent = formatPrice(total);
		}
	}

	function removeRow(event) {
		const button = event.currentTarget;
		const row = button.closest('.cart-item');
		const productId = row?.dataset.productId;
		if (row) {
			row.remove();
			updateTotals();
		}
		if (productId) {
			removeFromCart(productId);
		}
	}

	async function updateCartQuantity(productId, quantity) {
		if (!productId) return;
		const normalizedQty = Math.max(1, Number(quantity) || 1);
		try {
			if (typeof updateCart === 'function') {
				await updateCart(productId, normalizedQty);
			}
		} catch (err) {
			console.error('Error updating cart:', err);
		}
	}

	function onQuantityChange(event) {
		const input = event.currentTarget;
		const row = input.closest('.cart-item');
		const productId = row?.dataset.productId;
		updateTotals();
		if (productId) {
			updateCartQuantity(productId, Number(input.value));
		}
	}

	function collectCartItems() {
		return getCartRows().map((row) => {
			const productId = row.dataset.productId;
			const qty = Math.max(1, Number(row.querySelector('.cart-qty').value) || 1);
			const unitPrice = Number(row.dataset.unitPrice) || 0;
			const name = row.querySelector('.product-name')?.textContent.trim() || '';
			const description = row.querySelector('td:nth-child(3)')?.textContent.trim() || '';

			return {
				productId,
				qty,
				quantity: qty,
				unitPrice,
				name,
				description,
				product: { productId, name, description }
			};
		});
	}

	async function checkoutCart() {
		const items = collectCartItems();
		if (!items.length) {
			alert('Your cart is empty.');
			return;
		}

		try {
			const result = await addOrder();
			if (result?.order) {
				alert('Order placed successfully.');
				document.querySelector('.table-body').innerHTML = '';
				updateTotals();
			} else {
				alert('Unable to place order.');
			}
		} catch (err) {
			console.error('Checkout error:', err);
			alert('Could not place order.');
		}
	}

	document.addEventListener('DOMContentLoaded', async () => {
		await createCartTable();

		document.querySelectorAll('.remove-row').forEach(button => {
			button.addEventListener('click', removeRow);
		});

		document.querySelectorAll('.cart-qty').forEach(input => {
			input.addEventListener('input', onQuantityChange);
		});

		document.getElementById('checkoutButton').addEventListener('click', checkoutCart);

		updateTotals();
	});
}

else if (document.body.id === 'store-order') {
	let orderCache = [];

	function getOrderTotal(order) {
		const items = order.items || [];
		let subtotal = 0;
		let discountTotal = 0;
		items.forEach(item => {
			const qty = item.quantity || 1;
			const unitPrice = item.product_price || 0;
			subtotal += qty * unitPrice;
			discountTotal += (unitPrice * qty) * ((item.product_discount || 0) / 100);
		});
		return { subtotal, discountTotal, total: subtotal - discountTotal + shippingCost };
	}

	async function renderOrders() {
		const body = document.getElementById('ordersBody');
		let orders = await getOrders() || [];
		let temp = [];
				
		orders.forEach(row => {
			const {
				order_id,
				order_date,
				order_status,
				product_id,
				product_name,
				product_price,
				product_discount,
				product_image,
				product_description,
				item_quantity
			} = row;

			let order = temp.find(o => o.order_id === order_id);

			if (!order) {
				order = {
					order_id,
					order_date,
					order_status,
					items: []
				};

				temp.push(order);
			}

			order.items.push({
				product_id,
				product_name,
				product_price,
				product_discount,
				product_image,
				product_description,
				quantity: item_quantity
			});
		});

		orderCache = temp;

		body.innerHTML = orderCache.map(order => {
			const { total } = getOrderTotal(order);
			const itemCount = order.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
			return `
				<tr class="order-row" data-order-id="${order.order_id}">
					<td class="text-center">${order.order_id}</td>
					<td class="text-center">${itemCount}</td>
					<td class="text-right">₱${formatPrice(total)}</td>
					<td class="text-center"><span class="status-pill ${order.order_status.toLowerCase()}">${order.order_status}</span></td>
					<td class="text-center">${formatDate(order.order_date)}</td>
				</tr>
			`;
		}).join('');

		document.querySelectorAll('.order-row').forEach(row => {
			row.addEventListener('click', () => openOrder(row.dataset.orderId));
		});
	}

	function openOrder(orderId) {
		const order = orderCache.find(item => String(item.order_id) === String(orderId));
		if (!order) return;

		const items = order.items || [];
		const { subtotal, discountTotal, total } = getOrderTotal(order);
		document.getElementById('orderModalTitle').textContent = `Order #${order.order_id}`;
		document.getElementById('orderModalStatus').textContent = `Status: ${order.order_status}`;
		document.getElementById('orderModalSummary').textContent = `Date: ${formatDate(order.order_date)} • ${items.length} item${items.length > 1 ? 's' : ''}`;

		const list = document.getElementById('orderItemsList');
		list.innerHTML = items.map(item => {
			const qty = item.quantity;
			const unitPrice = item.product_price;
			const name = item.product_name;
			const details = item.product_description;
			const discount = item.product_discount || 0;
			return `
				<div class="order-detail-item">
					<div>
						<div class="product-name">${name}</div>
						<div class="product-sku">${details}</div>
					</div>
					<div class="text-center">${qty}</div>
					<div class="text-right">${formatPrice(qty * unitPrice)}</div>
				</div>
			`;
		}).join('');

		document.getElementById('modalSubtotal').textContent = `₱${formatPrice(subtotal)}`;
		document.getElementById('modalDiscount').textContent = `-₱${formatPrice(discountTotal)}`;
		document.getElementById('modalShipping').textContent = `₱${formatPrice(shippingCost)}`;
		document.getElementById('modalTotal').textContent = `₱${formatPrice(total)}`;
		document.getElementById('orderDetailsOverlay').hidden = false;
	}

	function closeOrderModal() {
		document.getElementById('orderDetailsOverlay').hidden = true;
	}

	document.addEventListener('DOMContentLoaded', () => {
		renderOrders();
		document.querySelector('.modal-close').addEventListener('click', closeOrderModal);
		document.getElementById('orderDetailsOverlay').addEventListener('click', event => {
			if (event.target.id === 'orderDetailsOverlay') closeOrderModal();
		});
	});
}





document.addEventListener('DOMContentLoaded', () => {
	const cardModalOverlay = document.querySelector('.card-modal-overlay');
	
	if (cardModalOverlay) {
		const modalTitle = cardModalOverlay.querySelector('.modal-title');
		const modalSubtitle = cardModalOverlay.querySelector('.modal-subtitle');
		const modalDescription = cardModalOverlay.querySelector('.modal-description');
		const modalImage = cardModalOverlay.querySelector('.modal-image');
		const closeButton = cardModalOverlay.querySelector('.modal-close');

		function closeCardModal() {
		cardModalOverlay.hidden = true;
		document.body.style.overflow = '';
		}

		// Add card pop-up for store cards
		function openCardModal(card) {
		const productName = card.querySelector('.detail-sample1, .item-detail1')?.textContent.trim() || 'Item details';
		const productDescription = card.querySelector('.detail-sample2, .item-detail2')?.textContent.trim() || '';
		const imageSource = card.dataset.productImage || '/img/home-image.png';

		const discountedPrice = formatPrice((Number(card.dataset.productPrice) || 0) * (1 - (Number(card.dataset.productDiscount) || 0) / 100));
		const originalPrice = `<s>₱${formatPrice(Number(card.dataset.productPrice) || 0)}</s>`;

		selectedProductId = card.dataset.productId || null;
		modalTitle.textContent = productName;
		modalSubtitle.innerHTML = `₱${card.dataset.productDiscount > 0 ? `${discountedPrice} ${originalPrice}` : `${formatPrice(Number(card.dataset.productPrice) || 0)}`}`;
		modalDescription.textContent = productDescription;
		modalImage.src = imageSource;
		cardModalOverlay.hidden = false;
		document.body.style.overflow = 'hidden';
		}

		const addCartButton = cardModalOverlay.querySelector('.modal-action.add-to-cart');
		if (addCartButton) {
			addCartButton.addEventListener('click', async () => {
				if (selectedProductId) {
					const quantityInput = cardModalOverlay.querySelector('#modal-quantity');
					const quantity = parseInt(quantityInput?.value) || 1;
					await addToCartItem(selectedProductId, quantity, { closeModal: true });
					// Reset quantity input for next use
					if (quantityInput) quantityInput.value = 1;
				} else {
					alert('No product selected to add to cart.');
				}
			});
		}

		const buyNowButton = cardModalOverlay.querySelector('.modal-action.buy-now');
		if (buyNowButton) {
			buyNowButton.addEventListener('click', async () => {
				if (!selectedProductId) {
					alert('No product selected to buy now.');
					return;
				}

				const quantityInput = cardModalOverlay.querySelector('#modal-quantity');
				const quantity = parseInt(quantityInput?.value) || 1;

				const result = await quickBuy(selectedProductId, quantity);
				if (result) {
					window.location.href = dashboardRoutes.Cart;
				}
			});
		}

		const cardsContainer = document.querySelector('.store-background');
		if (cardsContainer) {
		cardsContainer.addEventListener('click', (event) => {
			const card = event.target.closest('.deal-card, .item-card');
			if (card) {
			openCardModal(card);
			}
		});
		}

		closeButton.addEventListener('click', closeCardModal);
		cardModalOverlay.addEventListener('click', (event) => {
		if (event.target === cardModalOverlay) {
			closeCardModal();
		}
		});
	}
});
