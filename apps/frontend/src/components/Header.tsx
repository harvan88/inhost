export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">IH</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">INHOST</h1>
              <p className="text-sm text-gray-500">Multi-Channel Messaging Platform</p>
            </div>
          </div>

          <nav className="flex items-center space-x-6">
            <a href="#" className="text-gray-600 hover:text-primary transition">
              Dashboard
            </a>
            <a href="#" className="text-gray-600 hover:text-primary transition">
              Channels
            </a>
            <a href="#" className="text-gray-600 hover:text-primary transition">
              Settings
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
