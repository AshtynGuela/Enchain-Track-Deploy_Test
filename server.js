/**
 * 
 * NOTE: THIS IS A SAMPLE SERVER, repalce with a working backend later
*/

const express = require("express");
const cors = require("cors");
const path = require("path");
const encrypt = require("bcrypt");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));


// To connect with MySQL database in xampp
const mysql = require("mysql2/promise");
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'enchain' //Depends on the name used (change later)
});

async function testDB() {
    try {
        const [rows] = await db.query("SELECT 1");
        console.log("DB Connected Successfully ✔", rows);
    } catch (err) {
        console.error("DB Connection Failed ❌", err);
    }
}
testDB();

/**
	//sample
	const sample = [
		{name: "Sample1", description: "This is a sample product", category: "Category1", discount: 20, productId: "1", stock: 25, image: "/img/home-image.png", price: 25.00}, 
		{name: "Sample2", description: "This is another sample product", category: "Category2", discount: 0, productId: "2", stock: 15, image: "/img/home-image.png", price: 15.50},
		{name: "Sample3", description: "This is yet another sample product", category: "Category3", discount: 10, productId: "3", stock: 30, image: "/img/home-image.png", price: 25.25},
		{name: "Sample4", description: "This is  sample product, yet another", category: "Category2", discount: 15, productId: "4", stock: 20, image: "/img/home-image.png", price: 20.00},
		{name: "Sample5", description: "This is a fifth sample product", category: "Category1", discount: 25, productId: "5", stock: 10, image: "/img/home-image.png", price: 10.75},
		{name: "Sample6", description: "This is a sixth sample product", category: "Category3", discount: 0, productId: "6", stock: 35, image: "/img/home-image.png", price: 45.00},
		{name: "Sample7", description: "This is a seventh sample product", category: "Category1", discount: 5, productId: "7", stock: 20, image: "/img/home-image.png", price: 35.50},
		{name: "Sample8", description: "This is an eighth sample product", category: "Category2", discount: 30, productId: "8", stock: 15, image: "/img/home-image.png", price: 30.05},
		{name: "Sample9", description: "This is a ninth sample product", category: "Category3", discount: 0, productId: "9", stock: 25, image: "/img/home-image.png", price: 19.95},
		{name: "Sample10", description: "This is a tenth sample product", category: "Category1", discount: 10, productId: "10", stock: 30, image: "/img/home-image.png", price: 5.00}
	];

	let cart_sample = {
		"12345": [{product: sample[0], quantity: 2}]
	};

	let orders = {
		"12345": [
			{
				id: "ORD001",
				date: "2026-05-03",
				status: "shipped",
				shipping: 5,
				items: [{product: sample[2], quantity: 3}],
			},
			{
				id: "ORD002",
				date: "2026-04-28",
				status: "delivered",
				shipping: 0,
				items: [{product: sample[4], quantity: 2}, {product: sample[6], quantity: 1}],
			}
		]
	}

	Notes:
	Added attribute to product: producct_image, product_description and product_discount
	Carts are records in orders and order_items with status cart/pending
	In adding Order, turn cart into order by changing status to pending and updating stock of products. Add order date as well.
*/
app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        if (!username || !password) {
            return res.status(400).json({ message: "Missing username or password" });
        }

        if (username === "admin" && password === "admin") {
            return res.json({
                success: true,
                message: "Login successful",
                userId: "99999999",
                name: "Admin"
            });
        }

        const [[user]] = await db.query(
            `SELECT * FROM customer WHERE customer_name = ?`,
            [username]
        );

        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // match password with hashed password in database using bcrypt
        const match = await encrypt.compare(
            password,
            user.customer_passkey
        );

        if (!match) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        res.json({
            success: true,
            message: "Login successful",
            userId: user.customer_id,
            name: user.customer_name
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to login" });
    }
});

app.get("/user/:userId", async (req, res) => {
    const { userId } = req.params;

    try {
        const [user] = await db.query(`SELECT * FROM customer WHERE customer_id = ?`, [userId]);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch user" });
    }
});

// check if a product exists in the database via productID
async function productExists(productId) {
	try {
		const [product] = await db.query(`SELECT 1 FROM product WHERE product_id = ?`, [productId]);
		return product.length > 0;
	} catch (err) {
		console.error(err);
		return false;
	}
}

// checks customer existance
async function customerExists(userId) {
	try {
		const [customer] = await db.query(`SELECT 1 FROM customer WHERE customer_id = ?`, [userId]);
		return customer.length > 0;
	} catch (err) {
		console.error(err);
		return false;
	}
}

// checks order existance
async function orderExists(orderId, status=null) {
	try {
		let query = `SELECT 1 FROM orders WHERE order_id = ?`;
		let params = [orderId];

		if (status !== null) {
			query += ` AND order_status = ?`;
			params.push(status);
		}

		const [order] = await db.query(query, params);
		return order.length > 0;
	} catch (err) {
		console.error(err);
		return false;
	}
}

// updates product stock by reducing the quantity ordered
async function updateProductStock(productId, quantity) {
	// Assumes quantity is less than or equal to current stock (should be checked before calling this function)
	try {
		await db.query(`UPDATE product SET product_stock = product_stock - ? WHERE product_id = ?`, [quantity, productId]);
	} catch (err) {
		console.error(err);
	}
}


// get products
app.get("/products", async (req, res) => {
    try {
        const [products] = await db.query(`SELECT * FROM product ORDER BY product_discount DESC, product_type, product_name; `);

        res.json(products);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch products" });
    }
});

// get products ordered based on total orders/sales done in past two months
app.get("/products/popular", async (req, res) => {
    try {
        const [products] = await db.query(`
            SELECT  p.*
            FROM order_item AS oi JOIN product AS p ON p.product_id = oi.product_id
			GROUP BY p.product_id
			ORDER BY p.product_discount DESC, SUM(oi.item_quantity) DESC;
        `);

        res.json(products);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch products" });
    }
});

// get products ordered based on discount percentage
app.get("/products/discount", async (req, res) => {
    try {
        const [products] = await db.query(`
            SELECT p.*
            FROM product AS p
			WHERE p.product_discount > 0.00
			ORDER BY p.product_discount DESC;
        `);

        res.json(products);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch products" });
    }
});

// get all distinct categories of products
app.get("/products/categories", async (req, res) => {
    try {
        const [categories] = await db.query(`
            SELECT DISTINCT product_type FROM product ORDER BY product_type;
        `);

        res.json(categories);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch categories" });
    }
});


// get cart for a user
app.get("/cart/:userId", async (req, res) => {
    const { userId } = req.params;
    if (!userId) { return res.status(400).json({ message: "Missing userId" }); }

    try {
		const uExists = await customerExists(userId);
		if (!uExists) { return res.status(404).json({ message: "User not found" }); }

        const [cart] = await db.query(`
            SELECT p.*, oi.item_quantity
            FROM orders o
            JOIN order_item oi ON o.order_id = oi.order_id
            JOIN product p ON p.product_id = oi.product_id
            WHERE o.customer_id = ?
            AND o.order_status = 'cart'
        `, [userId]);

        res.json(cart);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch cart" });
    }
});

// add item to cart
app.post("/cart/:userId/:productId/:quantity", async (req, res) => {
    const { userId, productId, quantity } = req.params;
    if (!userId || !productId || !quantity) { return res.status(400).json({ message: "Missing data" }); }

    try {
		const uExists = await customerExists(userId);
		if (!uExists) { return res.status(404).json({ message: "User not found" }); }

		const pExists = await productExists(productId);
		if (!pExists) { return res.status(404).json({ message: "Product not found" }); }

        // Check existing cart
        let [cartRows] = await db.query(
			`SELECT order_id
             FROM orders
             WHERE customer_id = ?
             AND order_status = 'cart'
             LIMIT 1`,
            [userId]
        );

        let orderId;

        // Create cart if not exists
        if (cartRows.length === 0) {
            const [[row]] = await db.query(`SELECT COALESCE(MAX(order_id), 0) + 1 AS nextId FROM orders `);

			const nextId = row.nextId;

			await db.query(`
				INSERT INTO orders (
					order_id,
					customer_id,
					order_date,
					order_status
				)
				VALUES (?, ?, NOW(), 'cart')
			`, [nextId, userId]);

            orderId = nextId;
        } else {
            orderId = cartRows[0].order_id;
        }

        // Try update existing item
        let [updateResult] = await db.query(
            `UPDATE order_item
             SET item_quantity = ?
             WHERE order_id = ?
             AND product_id = ?`,
            [quantity || 1, orderId, productId]
        );

        // If no row updated -> insert new item
        if (updateResult.affectedRows === 0) {
            await db.query(
                `INSERT INTO order_item (order_id, product_id, item_quantity, item_price)
                 VALUES (
                    ?,
                    ?,
                    1,
                    (SELECT product_price FROM product WHERE product_id = ?)
                 )`,
                [orderId, productId, productId]
            );
        }

        res.json({ message: "Added to cart" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// delete item from cart
app.delete("/cart/:userId/:productId", async (req, res) => {
	const { userId, productId } = req.params;
    if (!userId || !productId) { return res.status(400).json({  message: "Missing data" });}

	try {
		const uExists = await customerExists(userId);
		if (!uExists) { return res.status(404).json({ message: "User not found"}); }

		const pExists = await productExists(productId);
		if (!pExists) { return res.status(404).json({ message: "Product not found" }); }

        // Check existing cart
        let [cartRows] = await db.query(
			`SELECT order_id
             FROM orders
             WHERE customer_id = ?
             AND order_status = 'cart'
             LIMIT 1`,
            [userId]
        );

        if (cartRows.length === 0) { return res.status(404).json({ message: "Cart not found" }); }

		orderId = cartRows[0].order_id;

        let [updateResult] = await db.query(
            `DELETE FROM order_item WHERE order_id = ? AND product_id = ?`,
            [orderId, productId]
        );

        res.json({ message: "Item removed from cart" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// update item in cart
app.put("/cart/:userId/:productId/:quantity", async (req, res) => {
	const { userId, productId, quantity } = req.params;
    const qty = Number(quantity);

	if (!userId || !productId || !quantity ) { return res.status(400).json({ message: "Missing data" }); }

	try {
		const uExists = await customerExists(userId);
		if (!uExists) { return res.status(404).json({ message: "User not found" }); }

		const pExists = await productExists(productId);
		if (!pExists) { return res.status(404).json({ message: "Product not found" }); }

        let [cartRows] = await db.query(
			`SELECT order_id
             FROM orders
             WHERE customer_id = ?
             AND order_status = 'cart'
             LIMIT 1`,
            [userId]
        );

        if (cartRows.length === 0) { return res.status(404).json({ message: "Cart not found" }); }
        
		let orderId = cartRows[0].order_id;

		const [[product]] = await db.query(`SELECT product_stock FROM product WHERE product_id = ?`, [productId]);

		if (quantity <= 0 || quantity > product.product_stock) { return res.status(400).json({ message: "Invalid quantity" });}

        let [updateResult] = await db.query(
            `UPDATE order_item
             SET item_quantity = ?
             WHERE order_id = ?
             AND product_id = ?`,
            [qty, orderId, productId]
        );

        res.json({ message: "Updated cart" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});



// get orders for user
app.get("/orders/:userId", async (req, res) => {
  	const { userId } = req.params;
    if (!userId) { return res.status(400).json({ message: "Missing userId" }); }

    try {
		const uExists = await customerExists(userId);
		if (!uExists) { return res.status(404).json({ message: "User not found" }); }

        const [orders] = await db.query(`
            SELECT o.*, p.*, oi.item_quantity
            FROM orders o
            JOIN order_item oi ON o.order_id = oi.order_id
            JOIN product p ON p.product_id = oi.product_id
            WHERE o.customer_id = ?
            AND o.order_status != 'cart'
            ORDER BY
				CASE order_status
					WHEN 'pending' THEN 1
					WHEN 'shipped' THEN 2
					WHEN 'delivered' THEN 3
					ELSE 4
				END,
				o.order_date 
        `, [userId]);

        res.json(orders);

    } catch (err) {
        console.error(err);
        res.status(500).json({message: "Failed to fetch orders"});
    }
});

// add orders for user, turn cart into order
app.post("/orders/:userId", async (req, res) => {
	console.log("Received request to place order");
	const { userId } = req.params;
    if (!userId) { return res.status(400).json({ message: "Missing userId" }); }

    try {
		const uExists = await customerExists(userId);
		if (!uExists) { return res.status(404).json({ message: "User not found" }); }

        const [[cartExists]] = await db.query(
            `SELECT 1 FROM orders WHERE customer_id = ? AND order_status = 'cart' LIMIT 1`,
            [userId]
        );

        if (!cartExists) { return res.status(404).json({ message: "Cart not found" }); }

        const [items] = await db.query(`
            SELECT oi.product_id, SUM(oi.item_quantity) AS qty
            FROM orders o
            JOIN order_item oi ON o.order_id = oi.order_id
            WHERE o.customer_id = ?
            AND o.order_status = 'cart'
            GROUP BY oi.product_id
        `, [userId]);

        for (const item of items) {
            const [result] = await db.query(`
                UPDATE product
                SET product_stock = product_stock - ?
                WHERE product_id = ?
                AND product_stock >= ?
            `, [item.qty, item.product_id, item.qty]);

            if (result.affectedRows === 0) {
                return res.status(400).json({ message: `Insufficient stock for product ${item.product_id}` });
            }
        }

        await db.query(`
            UPDATE orders
            SET order_status = 'pending',
                order_date = NOW()
            WHERE customer_id = ?
            AND order_status = 'cart'
        `, [userId]);

        res.json({ order: true, message: "Order created" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to place order" });
    }
});






app.get('/', async (req, res) => {
  res.sendFile(path.join(__dirname, 'store', 'home.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});