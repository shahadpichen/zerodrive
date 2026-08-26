import React from "react";
import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer
      className="mt-10 border-t pb-12 pt-10 text-center text-sm md:pt-14"
      itemScope
      itemType="https://schema.org/Organization"
    >
      <p>
        &copy; <span itemProp="name">ZeroDrive</span> — Browser-encrypted
        storage and private sharing on Google Drive.
      </p>
      <meta itemProp="url" content="https://zerodrive.xyz" />

      <div className="flex flex-wrap justify-center gap-4 mt-4">
        <Link to="/docs/how-to-use" className="hover:underline text-sm">
          Getting started
        </Link>
        <Link to="/docs/how-it-works" className="hover:underline text-sm">
          How ZeroDrive works
        </Link>
        <Link to="/docs/security-model" className="hover:underline text-sm">
          Security model
        </Link>
        <Link
          to="/docs/if-zerodrive-disappears"
          className="hover:underline text-sm"
        >
          Recovery and portability
        </Link>
        <Link to="/privacy" className="hover:underline text-sm">
          Privacy
        </Link>
        <Link to="/terms" className="hover:underline text-sm">
          Terms
        </Link>
        <a
          href="https://github.com/zerodrivehq/zerodrive"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline text-sm"
          itemProp="sameAs"
        >
          GitHub
        </a>
      </div>

      <p className="mt-4">Created by Shahad Pichen</p>
    </footer>
  );
}

export default Footer;
