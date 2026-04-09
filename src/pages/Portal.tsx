import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { User, Users, Sparkles, ChevronRight, ScanFace, ArrowRight } from 'lucide-react';

const cards = [
  {
    to: '/portrait-restore',
    icon: User,
    title: 'Phục hồi Ảnh Chân Dung & Ảnh Thờ',
    desc: 'Phục hồi khuôn mặt, khử xước, lên màu AI, thay trang phục — xuất ảnh lên đến 4K bằng Gemini Native.',
    color: 'blue',
    bgImage: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1200&auto=format&fit=crop',
    badge: 'Portrait',
  },
  {
    to: '/group-restore',
    icon: Users,
    title: 'Phục hồi Ảnh Tập Thể & Gia Đình',
    desc: 'Phân tích AI tự động đếm khuôn mặt, phục hồi toàn cảnh, khử xước và lên màu ảnh lịch sử bằng Gemini Native.',
    color: 'purple',
    badge: 'Group',
    bgImage: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=1200&auto=format&fit=crop',
  },
  {
    to: '/id-photo',
    icon: ScanFace,
    title: 'Chỉnh sửa Ảnh Thẻ (ID Photo)',
    desc: 'Chuẩn hóa ảnh hồ sơ với nền trơn, bố cục ảnh thẻ, chỉnh nhẹ hướng nhìn, biểu cảm và thay trang phục formal.',
    color: 'fuchsia',
    badge: 'ID Photo',
    bgImage: 'https://images.unsplash.com/photo-1531746020768-018614088e78?q=80&w=1200&auto=format&fit=crop',
  },
];

const colorMap: Record<string, { bg: string; border: string; shadow: string; text: string; iconBg: string; iconBorder: string; iconText: string; btnHover: string; glow: string; ring: string }> = {
  blue: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/50',
    shadow: 'shadow-blue-500/25',
    text: 'text-blue-400',
    iconBg: 'bg-blue-500/20',
    iconBorder: 'border-blue-500/30',
    iconText: 'text-blue-400',
    btnHover: 'bg-blue-500 border-blue-500',
    glow: 'from-blue-500/30 via-blue-600/20 to-transparent',
    ring: 'ring-blue-400/20',
  },
  purple: {
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/50',
    shadow: 'shadow-purple-500/25',
    text: 'text-purple-400',
    iconBg: 'bg-purple-500/20',
    iconBorder: 'border-purple-500/30',
    iconText: 'text-purple-400',
    btnHover: 'bg-purple-600 border-purple-600',
    glow: 'from-purple-500/30 via-purple-600/20 to-transparent',
    ring: 'ring-purple-400/20',
  },
  fuchsia: {
    bg: 'bg-fuchsia-500/20',
    border: 'border-fuchsia-500/50',
    shadow: 'shadow-fuchsia-500/25',
    text: 'text-fuchsia-400',
    iconBg: 'bg-fuchsia-500/20',
    iconBorder: 'border-fuchsia-500/30',
    iconText: 'text-fuchsia-400',
    btnHover: 'bg-fuchsia-600 border-fuchsia-600',
    glow: 'from-fuchsia-500/30 via-fuchsia-600/20 to-transparent',
    ring: 'ring-fuchsia-400/20',
  },
};

export default function Portal() {
  return (
    <div className="h-auto min-h-screen w-full bg-gray-950 text-white flex flex-col items-center py-12 px-4 overflow-x-hidden relative selection:bg-blue-500/30">
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed top-[40%] left-[50%] w-[30%] h-[30%] bg-fuchsia-600/5 blur-[100px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12 md:mb-20 z-10 mt-8 md:mt-16"
      >
        <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-4 mb-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-xl shadow-blue-500/20">
            <Sparkles className="w-6 h-6 md:w-7 md:h-7 text-white" />
          </div>
          <h1 className="text-2xl md:text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/40">
            QUANGTHOAI RESTORE
          </h1>
        </div>
        <p className="text-[10px] md:text-lg font-medium text-white/40 tracking-[0.2em] uppercase px-4">
          AI Photo Restoration Workspace
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-white/20" />
          <span className="text-[9px] md:text-xs text-white/25 tracking-widest uppercase">Choose your workspace</span>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-white/20" />
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8 w-full max-w-7xl z-10 mb-20">
        {cards.map((card, i) => {
          const c = colorMap[card.color];
          const Icon = card.icon;
          return (
            <motion.div
              key={card.to}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.12, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <Link to={card.to} className="group block h-full">
                <div className={`h-full bg-gray-900/80 border border-white/[0.08] rounded-2xl md:rounded-3xl flex flex-col transition-all duration-700 hover:scale-[1.03] hover:${c.border} hover:shadow-2xl hover:${c.shadow} relative overflow-hidden backdrop-blur-sm`}>
                  <div className="absolute inset-0 z-0">
                    <img
                      src={card.bgImage}
                      alt={card.badge}
                      className="w-full h-full object-cover opacity-[0.15] group-hover:opacity-50 transition-all duration-700 scale-105 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                    <div className={`absolute inset-0 bg-gradient-to-t ${c.glow} opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/90 to-gray-950/40 group-hover:from-gray-950/90 group-hover:via-gray-950/60 group-hover:to-transparent transition-all duration-700" />
                  </div>

                  <div className="absolute top-4 right-4 md:top-6 md:right-6 z-10">
                    <span className={`text-[9px] md:text-[10px] font-bold tracking-[0.15em] uppercase px-2.5 py-1 rounded-full border backdrop-blur-md transition-all duration-500 ${c.text} ${c.iconBorder} ${c.bg} group-hover:bg-white/10`}>
                      {card.badge}
                    </span>
                  </div>

                  <div className="relative z-10 p-6 md:p-10 flex flex-col gap-4 md:gap-6 flex-1">
                    <div className={`w-12 h-12 md:w-14 md:h-14 ${c.iconBg} backdrop-blur-md rounded-xl md:rounded-2xl flex items-center justify-center border ${c.iconBorder} group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
                      <Icon className={`w-6 h-6 md:w-7 md:h-7 ${c.iconText} transition-transform duration-500`} />
                    </div>

                    <div className="space-y-2 md:space-y-3">
                      <h2 className={`text-xl md:text-2xl font-bold tracking-tight text-white group-hover:${c.text} transition-colors duration-500`}>
                        {card.title}
                      </h2>
                      <p className="text-white/50 leading-relaxed text-sm md:text-base group-hover:text-white/70 transition-colors duration-500">
                        {card.desc}
                      </p>
                    </div>

                    <div className="mt-auto pt-4 md:pt-6">
                      <div className={`inline-flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 bg-white/[0.06] backdrop-blur-md border border-white/10 text-white/80 rounded-full text-xs md:text-sm font-bold group-hover:${c.btnHover} group-hover:text-white transition-all duration-500`}>
                        Mở Workspace
                        <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4 group-hover:translate-x-1 transition-transform duration-300" />
                      </div>
                    </div>
                  </div>

                  <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${c.bg.replace('/20', '')} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-auto pb-8 text-[8px] md:text-[10px] text-white/20 tracking-widest uppercase text-center z-10"
      >
        © 2026 QUANGTHOAI RESTORE • Powered by Google Gemini AI
      </motion.p>
    </div>
  );
}