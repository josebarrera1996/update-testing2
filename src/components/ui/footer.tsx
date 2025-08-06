// components/ui/Footer.tsx
import React from "react";

const Footer = () => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 py-1 bg-background pointer-events-none">
      <div className="text-center text-xs italic text-muted-foreground">
        HestIA 3.3.9 | Powered by Garage Deep Analytics ©
      </div>
    </footer>
  );
};

export default Footer;
