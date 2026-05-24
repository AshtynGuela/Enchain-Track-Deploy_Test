/**
 * This file contains the js code for the login and sign up.
 */

const API_BASE = "http://localhost:3000";
clearUserSession();

document.addEventListener("DOMContentLoaded", () => {

	const signupForm = document.querySelector("#signup-form");
	const loginForm = document.querySelector("#login-form");

	// for customers only, employees are added in the employee management
	if (signupForm) {
		signupForm.addEventListener("submit", async (e) => {
			e.preventDefault();
			console.log("signup working");

			const formData = new FormData(signupForm);
			const data = Object.fromEntries(formData.entries());

			try {
				const res = await fetch(`${API_BASE}/signup`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify(data)
				});

				const result = await res.json();

				if (result.success) {
					window.location.href = "/login.html";
				} else {
					alert(result.message);
				}

			} catch (err) {
				console.error(err);
				alert("Something went wrong");
			}
		});
	}

	if (loginForm) {
		loginForm.addEventListener("submit", async (e) => {
			e.preventDefault();
			console.log("login working");
			const formData = new FormData(loginForm);
			const data = Object.fromEntries(formData.entries());

			const res = await fetch(`${API_BASE}/login`, {
				method: "POST",
				headers: {
				"Content-Type": "application/json"
				},
				body: JSON.stringify(data)
			});

			const result = await res.json();

			if (result.success) {
				if (result.role === "employee") {
					localStorage.setItem("userId", result.userId);
					localStorage.setItem("username", result.name);
					window.location.href = "/dashboard/home.html";
				}
				else {					
					localStorage.setItem("userId", result.userId);
					localStorage.setItem("username", result.name);
					window.location.href = "/store/home.html";
				}
			} else {
				alert(result.message);
			}
		});
	}
});
