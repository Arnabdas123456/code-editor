import Link from 'next/link';
import { Sparkles, Github, Twitter } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-[#0a0a12] border-t border-white/5 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          <div>
            <Link href="/" className="flex items-center gap-2 group mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                AI Studio
              </span>
            </Link>
            <p className="text-gray-400 text-sm">
              Turn ideas into production-ready software with AI
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-6 md:justify-center">
            <Link
              href="#"
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              Documentation
            </Link>
            <Link
              href="#"
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              GitHub
            </Link>
            <Link
              href="#"
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              Privacy Policy
            </Link>
            <Link
              href="#"
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              Terms
            </Link>
          </div>

          <div className="flex gap-4 md:justify-end">
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all duration-300 hover:scale-110"
            >
              <Twitter className="w-5 h-5 text-gray-400" />
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all duration-300 hover:scale-110"
            >
              <Github className="w-5 h-5 text-gray-400" />
            </a>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-white/5 text-center text-gray-500 text-sm">
          © 2024 AI Studio. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
