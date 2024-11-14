import React from "react";
import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer className="text-center text-gray-600 mt-20 pb-12">
      <p>
        &copy; ZeroDrive - A platform for secure file storage on Google Drive.
      </p>

      <div className="flex flex-wrap justify-center gap-4 mt-4">
        <Link to="/privacy" className="text-blue-600 hover:underline text-sm">
          Privacy Policy
        </Link>
        <Link to="/terms" className="text-blue-600 hover:underline text-sm">
          Terms of Service
        </Link>
      </div>

      <p className="mt-4">Created by Shahad Pichen</p>
    </footer>
  );
}

export default Footer;
