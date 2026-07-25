"use strict";

/* ===== Smooth scrolling ====== */
/*  Note: You need to include smoothscroll.min.js (smooth scroll behavior polyfill) on the page to cover some browsers */
/* Ref: https://github.com/iamdustan/smoothscroll */

const pageNavLinks = document.querySelectorAll('.scrollto');

pageNavLinks.forEach((pageNavLink) => {

	pageNavLink.addEventListener('click', (e) => {

		const href = pageNavLink.getAttribute('href');

		// Chỉ xử lý smooth-scroll khi href là anchor trong cùng trang (#...)
		if (!href || !href.startsWith('#')) {
			return; // để trình duyệt điều hướng bình thường (chuyển trang)
		}

		e.preventDefault();

		const target = href.replace('#', '');
		const targetEl = document.getElementById(target);

		if (targetEl) {
			targetEl.scrollIntoView({ behavior: 'smooth' });
		}

	});

});