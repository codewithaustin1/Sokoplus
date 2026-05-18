import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Shop</h3>
          <ul className="mt-4 space-y-2">
            <li><Link to="/" className="text-sm text-gray-600 hover:text-orange-600">All Products</Link></li>
            <li><Link to="/" className="text-sm text-gray-600 hover:text-orange-600">Categories</Link></li>
            <li><Link to="/blog" className="text-sm text-gray-600 hover:text-orange-600">Blog</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Support</h3>
          <ul className="mt-4 space-y-2">
            <li className="text-sm text-gray-600">Returns Policy</li>
            <li className="text-sm text-gray-600">Shipping Info</li>
            <li className="text-sm text-gray-600">FAQ</li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Company</h3>
          <ul className="mt-4 space-y-2">
            <li className="text-sm text-gray-600">About Sokoplus</li>
            <li className="text-sm text-gray-600">Privacy Policy</li>
            <li className="text-sm text-gray-600">GDPR Compliance</li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Connect</h3>
          <ul className="mt-4 space-y-2 text-sm text-gray-600">
            <li>Nairobi, Kenya</li>
            <li>support@sokoplus.co.ke</li>
            <li>+254 700 000000</li>
          </ul>
        </div>
      </div>
      <div className="mt-12 border-t border-gray-100 pt-8 text-center text-xs text-gray-400">
        &copy; {new Date().getFullYear()} Sokoplus Kenya. All rights reserved. Built for trust and efficiency.
      </div>
    </footer>
  );
}
