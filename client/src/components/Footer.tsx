import { Link } from "wouter";
import { Music } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-neutral-800 text-neutral-300 py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Music className="w-8 h-8 text-white" />
              <h2 className="font-poppins font-bold text-2xl text-white">Karaoke Maker</h2>
            </div>
            <p className="mb-4">Transform your music experience with our audio extraction and transposition tools.</p>
            <div className="flex gap-4">
              <a href="#" className="text-neutral-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3c.3 0 2.6.1 3.8 1.3l.5.5c.6.7 1.4 1.7 1.4 4.5 0 2-.1a5 5 0 01-1 3.2l-.2.3c-.6.9-1.5 1.9-2 2.6 1.2.7 2.9 1.2 4.6 1.7l.2.1c.4.1.9.3 1.4.5.3.1.5.4.6.7a1 1 0 01-.3 1.1l-.1.1c-.5.5-1.2.5-1.8.5l-.5-.1c-1.7-.3-3.8-1-5.8-2.2-2 1.2-4 1.9-5.8 2.2a4 4 0 01-.5.1 1.7 1.7 0 01-1.8-.5l-.1-.1c-.2-.2-.3-.4-.3-.6 0-.2 0-.4.2-.6.2-.3.5-.4.8-.5l1.4-.5.2-.1c1.7-.5 3.4-1 4.6-1.7-.5-.7-1.4-1.7-2-2.6l-.2-.3a5 5 0 01-1-3.2c0-2.8.8-3.8 1.4-4.5l.5-.5C9.4 3.1 11.7 3 12 3z" />
                </svg>
              </a>
              <a href="#" className="text-neutral-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </a>
              <a href="#" className="text-neutral-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="font-poppins font-semibold text-lg mb-4 text-white">Product</h3>
            <ul className="space-y-2">
              <li><Link href="/features"><span className="hover:text-white transition-colors cursor-pointer">Features</span></Link></li>
              <li><Link href="/pricing"><span className="hover:text-white transition-colors cursor-pointer">Pricing</span></Link></li>
              <li><Link href="/api"><span className="hover:text-white transition-colors cursor-pointer">API</span></Link></li>
              <li><Link href="/integrations"><span className="hover:text-white transition-colors cursor-pointer">Integrations</span></Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-poppins font-semibold text-lg mb-4 text-white">Resources</h3>
            <ul className="space-y-2">
              <li><Link href="/docs"><span className="hover:text-white transition-colors cursor-pointer">Documentation</span></Link></li>
              <li><Link href="/tutorials"><span className="hover:text-white transition-colors cursor-pointer">Tutorials</span></Link></li>
              <li><Link href="/blog"><span className="hover:text-white transition-colors cursor-pointer">Blog</span></Link></li>
              <li><Link href="/support"><span className="hover:text-white transition-colors cursor-pointer">Support</span></Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-poppins font-semibold text-lg mb-4 text-white">Company</h3>
            <ul className="space-y-2">
              <li><Link href="/about"><span className="hover:text-white transition-colors cursor-pointer">About</span></Link></li>
              <li><Link href="/careers"><span className="hover:text-white transition-colors cursor-pointer">Careers</span></Link></li>
              <li><Link href="/privacy"><span className="hover:text-white transition-colors cursor-pointer">Privacy Policy</span></Link></li>
              <li><Link href="/terms"><span className="hover:text-white transition-colors cursor-pointer">Terms of Service</span></Link></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-neutral-700 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} Karaoke Maker. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
