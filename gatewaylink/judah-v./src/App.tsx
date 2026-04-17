import { motion } from "motion/react";

export default function App() {
  const links = [
    { label: "Experience", url: "https://www.judahv.site/experience/" },
    { label: "Trajectory", url: "https://www.judahv.site/trajectory/" },
    { label: "Education", url: "https://www.judahv.site/education/" },
  ];

  return (
    <div className="relative min-h-screen w-full bg-black font-[family-name:var(--font-syne)] flex flex-col justify-center overflow-hidden">
      
      {/* Animated Background Layers */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Deep Red Orb */}
        <motion.div
          animate={{
            x: ["-20%", "20%", "-10%", "-20%"],
            y: ["-20%", "30%", "10%", "-20%"],
            scale: [1, 1.2, 0.8, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] max-w-[600px] max-h-[600px] bg-red-600 rounded-full mix-blend-screen opacity-70 blur-[80px]"
        />
        {/* Soft White Orb */}
        <motion.div
          animate={{
            x: ["20%", "-20%", "10%", "20%"],
            y: ["30%", "10%", "-10%", "30%"],
            scale: [0.8, 1.2, 1, 0.8],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-1/4 right-1/4 w-[35vw] h-[35vw] max-w-[500px] max-h-[500px] bg-white rounded-full mix-blend-screen opacity-20 blur-[100px]"
        />
        {/* Dark Ruby Pulse */}
        <motion.div
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50vw] h-[50vw] bg-[#8B0000] rounded-full mix-blend-screen blur-[120px]"
        />
      </div>

      {/* Grain Overlay */}
      <div className="absolute inset-0 bg-noise mix-blend-overlay opacity-30 pointer-events-none" />

      {/* Content Links */}
      <div className="relative z-10 w-full px-8 md:px-24">
        <div className="flex flex-col gap-6 md:gap-8">
          {links.map((link, index) => (
            <motion.a
              key={link.label}
              href={link.url}
              initial={{ opacity: 0, y: 40, filter: "blur(5px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: index * 0.15, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="group block w-fit relative"
            >
              <span className="block text-white font-extrabold text-6xl md:text-8xl lg:text-[11rem] leading-[0.8] tracking-tighter uppercase transition-all duration-500 group-hover:text-red-500 group-hover:translate-x-8 group-hover:scale-105 origin-left mix-blend-plus-lighter">
                {link.label}
              </span>
            </motion.a>
          ))}
        </div>
      </div>

      {/* Subtle site identifier */}
      <div className="fixed bottom-8 right-8 z-20 pointer-events-none">
        <span className="text-[10px] uppercase tracking-[0.4em] text-white opacity-20 font-bold">
          judahv.site
        </span>
      </div>
    </div>
  );
}
