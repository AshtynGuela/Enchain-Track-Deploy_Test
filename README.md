# Enchain-Track

E-Commerce (customer) and inventory management system (owner) made for the business "Enchainted" located in Albay. Built with Node, Express and MySQL. Contains CRUD functionalities for ease of access for the owner.

## Primary Features

1. * **Storefront**: Customers, when signed up, can browse products, see popular items, filter by pre-set categories as well as having prioritized view for discounted items. Likewise, customers can take "add to cart" items and place orders, inclusive of GCash reference tracking should it be available. Does not include QRs yet for testing as well as image submissions.

2. * **Dashboard**: Intended for use by employees or owners. There is no option to create new employee or owner accounts aside from hardcoding them within the database itself. This allows visual summary of revenue, sales, top-selling products and critical stock alerts. Stock is only affected when customers have made orders. Has inline Edit mode for editing, creation and deleting of relevant items.

Orders and Sales can easily just be tracked and managed in real time.

## Stack Used:
1. **Backend**: Node.js and Express.js
2. **Database**: MySQL using `mysql12`
3. **Authentication**: `bcrypt` for password hashing
4. **Frontend**: HTML5, CSS3, Vanilla JS

* **Storefront**: Users can browse products, see popular items, filter by categories, and take advantage of discounts.
* **Shopping Cart & Checkout**: Add, remove, or update items in a shopping cart and place orders. Includes support for quick buy and GCash reference tracking.
* **Admin Dashboard**: Visual summary of revenue, sales, top-selling products, and critical stock alerts.
* **Inventory Management**: Interactive, inline "Edit Mode" to quickly adjust stock levels, prices, and discounts directly from the admin tables.
* **Order Management**: Track orders, adjust order statuses (Pending, Processing, Completed), and review customer order history.
* **Role-Based Access**: Distinct login pathways and workflows for both customers and employees (admins).

## Tech Stack

* **Backend**: Node.js, Express.js
* **Database**: MySQL (using `mysql2`, designed to be run with XAMPP)
* **Authentication**: `bcrypt` for secure password hashing
* **Frontend**: HTML5, CSS3, Vanilla JavaScript (with a responsive, dynamic UI)
* **Environment Management**: `dotenv` for configuration

## Project Structure

* `server.js`: Main Express server for routing, REST API endpoints and db connections.
* `dashboard/`: HTML files for  admin interface (Home, Inventory, Products, Sales, Orders, Suppliers).
* `store/`: HTML files for  customer storefront.
* `css/`: Centralized styling for the application.
* `dashboard.js` & `store.js`: Client-side JavaScript handling dynamic UI updates, admin features like Edit Mode, Cart state, and sorting.
* `login.html` & `signup.html`: User authentication pages.

