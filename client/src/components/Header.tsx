import { Link } from "wouter";
import { Music } from "lucide-react";

export default function Header() {
  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <Music className="w-8 h-8 text-primary" />
            <h1 className="font-poppins font-bold text-2xl text-primary">Harmonic</h1>
          </div>
        </Link>
        <nav>
          <ul className="flex space-x-6">
            <li>
              <Link href="/">
                <a className="text-neutral-700 hover:text-primary transition-colors font-medium">Home</a>
              </Link>
            </li>
            <li>
              <Link href="/#how-it-works">
                <a className="text-neutral-700 hover:text-primary transition-colors font-medium">How It Works</a>
              </Link>
            </li>
            <li>
              <Link href="/#faq">
                <a className="text-neutral-700 hover:text-primary transition-colors font-medium">FAQ</a>
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
