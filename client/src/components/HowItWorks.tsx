export default function HowItWorks() {
  return (
    <section className="mb-16" id="how-it-works">
      <h2 className="font-poppins font-bold text-2xl mb-8 text-neutral-900">How It Works</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white rounded-xl overflow-hidden shadow-md">
          <div className="h-48 bg-primary/5 flex items-center justify-center">
            <svg className="w-24 h-24 text-primary/70" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 4.5V16.5M12 16.5C10.3431 16.5 9 17.8431 9 19.5C9 21.1569 10.3431 22.5 12 22.5C13.6569 22.5 15 21.1569 15 19.5C15 17.8431 13.6569 16.5 12 16.5ZM18 7.5V4.5M18 4.5C16.3431 4.5 15 5.84315 15 7.5C15 9.15685 16.3431 10.5 18 10.5C19.6569 10.5 21 9.15685 21 7.5C21 5.84315 19.6569 4.5 18 4.5ZM6 7.5V4.5M6 4.5C4.34315 4.5 3 5.84315 3 7.5C3 9.15685 4.34315 10.5 6 10.5C7.65685 10.5 9 9.15685 9 7.5C9 5.84315 7.65685 4.5 6 4.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="p-6">
            <h3 className="font-poppins font-semibold text-lg mb-2">1. Extract</h3>
            <p className="text-neutral-700">Our AI separates the instrumental track from vocals using advanced audio processing.</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl overflow-hidden shadow-md">
          <div className="h-48 bg-secondary/5 flex items-center justify-center">
            <svg className="w-24 h-24 text-secondary/70" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 19V6.5L21 4V16.5M9 19C9 20.1046 7.88071 21 6.5 21C5.11929 21 4 20.1046 4 19C4 17.8954 5.11929 17 6.5 17C7.88071 17 9 17.8954 9 19ZM21 16.5C21 17.6046 19.8807 18.5 18.5 18.5C17.1193 18.5 16 17.6046 16 16.5C16 15.3954 17.1193 14.5 18.5 14.5C19.8807 14.5 21 15.3954 21 16.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="p-6">
            <h3 className="font-poppins font-semibold text-lg mb-2">2. Transform</h3>
            <p className="text-neutral-700">Change the musical key of the instrumental to match your vocal range or instrument.</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl overflow-hidden shadow-md">
          <div className="h-48 bg-accent/5 flex items-center justify-center">
            <svg className="w-24 h-24 text-accent/70" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 17.5V12M9 12V5L20 3V10.5M9 12C9 13.3807 7.88071 14.5 6.5 14.5C5.11929 14.5 4 13.3807 4 12C4 10.6193 5.11929 9.5 6.5 9.5C7.88071 9.5 9 10.6193 9 12ZM20 10.5C20 11.8807 18.8807 13 17.5 13C16.1193 13 15 11.8807 15 10.5C15 9.11929 16.1193 8 17.5 8C18.8807 8 20 9.11929 20 10.5ZM9 17.5C9 18.8807 7.88071 20 6.5 20C5.11929 20 4 18.8807 4 17.5C4 16.1193 5.11929 15 6.5 15C7.88071 15 9 16.1193 9 17.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="p-6">
            <h3 className="font-poppins font-semibold text-lg mb-2">3. Create</h3>
            <p className="text-neutral-700">Download your processed track and use it for performances, practice, or production.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
