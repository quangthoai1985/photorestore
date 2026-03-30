import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { User, Users, Sparkles, ChevronRight, Wand2 } from 'lucide-react';

export default function Portal() {
  return (
    <div className="h-auto min-h-screen w-full bg-gray-950 text-white flex flex-col items-center py-12 px-4 overflow-x-hidden relative selection:bg-blue-500/30">
      {/* Background Glows */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Header Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10 md:mb-16 z-10 mt-8 md:mt-12"
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
      </motion.div>

      {/* Navigation Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 w-full max-w-7xl z-10 mb-20">
        {/* Card 1: Portrait */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Link to="/portrait-restore" className="group block h-full">
            <div className="h-full bg-gray-900 border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-10 flex flex-col gap-4 md:gap-6 transition-all duration-500 hover:scale-[1.02] hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/20 relative overflow-hidden">
              {/* Background Image */}
              <div className="absolute inset-0 z-0">
                <img 
                  src="https://images.unsplash.com/photo-1509928015542-0ccfc1378396?q=80&w=800&auto=format&fit=crop" 
                  alt="Portrait Background" 
                  className="w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-opacity duration-500 grayscale group-hover:grayscale-0"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent" />
              </div>
              
              <div className="relative z-10 w-12 h-12 md:w-14 md:h-14 bg-blue-500/20 backdrop-blur-md rounded-xl md:rounded-2xl flex items-center justify-center border border-blue-500/30 group-hover:scale-110 transition-transform duration-500">
                <User className="w-6 h-6 md:w-7 md:h-7 text-blue-400" />
              </div>
              
              <div className="relative z-10 space-y-2 md:space-y-3">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white group-hover:text-blue-400 transition-colors">
                  Phục hồi Ảnh Chân Dung & Ảnh Thờ
                </h2>
                <p className="text-white/60 leading-relaxed text-sm md:text-base">
                  Tối ưu hóa khuôn mặt, thay đổi trang phục, bối cảnh và phục chế ảnh chân dung độ nét cao (Lên tới 4K).
                </p>
              </div>

              <div className="relative z-10 mt-4 md:mt-auto pt-2 md:pt-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 bg-white/10 backdrop-blur-md border border-white/10 text-white rounded-full text-xs md:text-sm font-bold group-hover:bg-blue-500 group-hover:border-blue-500 transition-all">
                  Mở Workspace
                  <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
                </div>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Card 2: Group */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Link to="/group-restore" className="group block h-full">
            <div className="h-full bg-gray-900 border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-10 flex flex-col gap-4 md:gap-6 transition-all duration-500 hover:scale-[1.02] hover:border-purple-500/50 hover:shadow-2xl hover:shadow-purple-500/20 relative overflow-hidden">
              {/* Background Image */}
              <div className="absolute inset-0 z-0">
                <img 
                  src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=800&auto=format&fit=crop" 
                  alt="Group Background" 
                  className="w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-opacity duration-500 grayscale group-hover:grayscale-0"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent" />
              </div>

              <div className="relative z-10 w-12 h-12 md:w-14 md:h-14 bg-purple-500/20 backdrop-blur-md rounded-xl md:rounded-2xl flex items-center justify-center border border-purple-500/30 group-hover:scale-110 transition-transform duration-500">
                <Users className="w-6 h-6 md:w-7 md:h-7 text-purple-400" />
              </div>
              
              <div className="relative z-10 space-y-2 md:space-y-3">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white group-hover:text-purple-400 transition-colors">
                  Phục hồi Ảnh Tập Thể & Gia Đình
                </h2>
                <p className="text-white/60 leading-relaxed text-sm md:text-base">
                  Tự động nhận diện nhiều khuôn mặt, cân bằng ánh sáng tổng thể, khử xước và lên màu ảnh lịch sử.
                </p>
              </div>

              <div className="relative z-10 mt-4 md:mt-auto pt-2 md:pt-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 bg-white/10 backdrop-blur-md border border-white/10 text-white rounded-full text-xs md:text-sm font-bold group-hover:bg-purple-600 group-hover:border-purple-600 transition-all">
                  Mở Workspace
                  <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
                </div>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Card 3: Pro Retouch */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Link to="/pro-retouch" className="group block h-full">
            <div className="h-full bg-gray-900 border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-10 flex flex-col gap-4 md:gap-6 transition-all duration-500 hover:scale-[1.02] hover:border-pink-500/50 hover:shadow-2xl hover:shadow-pink-500/20 relative overflow-hidden">
              {/* Background Image */}
              <div className="absolute inset-0 z-0">
                <img 
                  src="https://images.unsplash.com/photo-1515377905703-c4788e51af15?q=80&w=800&auto=format&fit=crop" 
                  alt="Beauty Background" 
                  className="w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-opacity duration-500 grayscale group-hover:grayscale-0"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent" />
              </div>

              <div className="relative z-10 w-12 h-12 md:w-14 md:h-14 bg-pink-500/20 backdrop-blur-md rounded-xl md:rounded-2xl flex items-center justify-center border border-pink-500/30 group-hover:scale-110 transition-transform duration-500">
                <Wand2 className="w-6 h-6 md:w-7 md:h-7 text-pink-400" />
              </div>
              
              <div className="relative z-10 space-y-2 md:space-y-3">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white group-hover:text-pink-400 transition-colors">
                  Chỉnh sửa Chân dung Chuyên nghiệp
                </h2>
                <p className="text-white/60 leading-relaxed text-sm md:text-base">
                  Làm đẹp da, chỉnh sửa mắt, nụ cười, trang điểm AI và đánh sáng studio chuyên nghiệp.
                </p>
              </div>

              <div className="relative z-10 mt-4 md:mt-auto pt-2 md:pt-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 bg-white/10 backdrop-blur-md border border-white/10 text-white rounded-full text-xs md:text-sm font-bold group-hover:bg-pink-600 group-hover:border-pink-600 transition-all">
                  Mở Workspace
                  <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
                </div>
              </div>
            </div>
          </Link>
        </motion.div>
      </div>

      {/* Footer Info */}
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-auto pb-8 text-[8px] md:text-[10px] text-white/20 tracking-widest uppercase text-center z-10"
      >
        © 2026 QUANGTHOAI RESTORE • Powered by Google Gemini AI
      </motion.p>
    </div>
  );
}
