import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, ScanFace, Sparkles, User, Users } from 'lucide-react';

type CardTone = {
  accentText: string;
  badgeClass: string;
  iconClass: string;
  borderGlow: string;
  buttonClass: string;
  imageGlow: string;
  hoverText: string;
  spotlight: string;
};

const cards = [
  {
    to: '/portrait-restore',
    icon: User,
    title: 'Phuc hoi Anh Chan Dung & Anh Tho',
    desc: 'Khoi phuc guong mat, va xoa vet xuoc, len mau AI va nang cap chi tiet cho anh chan dung cu va anh tho gia dinh.',
    badge: 'Portrait',
    bgImage: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=1400&auto=format&fit=crop',
    tone: {
      accentText: 'text-sky-200',
      badgeClass: 'border-sky-300/35 bg-sky-400/10 text-sky-100',
      iconClass: 'border-sky-300/30 bg-sky-300/12 text-sky-100 shadow-[0_0_40px_rgba(56,189,248,0.18)]',
      borderGlow: 'group-hover:border-sky-300/45 group-hover:shadow-[0_30px_90px_rgba(14,165,233,0.18)]',
      buttonClass: 'group-hover:border-sky-300/60 group-hover:bg-sky-300 group-hover:text-slate-950',
      imageGlow: 'from-sky-300/35 via-cyan-300/18 to-transparent',
      hoverText: 'group-hover:text-sky-100',
      spotlight: 'bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.28),transparent_45%)]',
    } satisfies CardTone,
  },
  {
    to: '/group-restore',
    icon: Users,
    title: 'Phuc hoi Anh Tap The & Gia Dinh',
    desc: 'Tai tao bo cuc tong the, giu tu nhien tung khuon mat va lam sach cac buc anh gia dinh, anh cuoi, anh ky niem nhieu nguoi.',
    badge: 'Family',
    bgImage: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=1400&auto=format&fit=crop',
    tone: {
      accentText: 'text-amber-100',
      badgeClass: 'border-amber-200/35 bg-amber-300/10 text-amber-50',
      iconClass: 'border-amber-200/30 bg-amber-200/10 text-amber-50 shadow-[0_0_40px_rgba(251,191,36,0.16)]',
      borderGlow: 'group-hover:border-amber-200/45 group-hover:shadow-[0_30px_90px_rgba(245,158,11,0.18)]',
      buttonClass: 'group-hover:border-amber-200/60 group-hover:bg-amber-200 group-hover:text-stone-950',
      imageGlow: 'from-amber-200/35 via-orange-300/16 to-transparent',
      hoverText: 'group-hover:text-amber-50',
      spotlight: 'bg-[radial-gradient(circle_at_top_left,rgba(253,230,138,0.22),transparent_45%)]',
    } satisfies CardTone,
  },
  {
    to: '/id-photo',
    icon: ScanFace,
    title: 'Chinh sua Anh The (ID Photo)',
    desc: 'Can chinh anh the sach se, dung bo cuc, nen studio chuan ho so va toi uu trang phuc, huong nhin, bieu cam.',
    badge: 'ID Photo',
    bgImage: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?q=80&w=1400&auto=format&fit=crop',
    tone: {
      accentText: 'text-rose-100',
      badgeClass: 'border-rose-200/35 bg-rose-300/10 text-rose-50',
      iconClass: 'border-rose-200/30 bg-rose-200/10 text-rose-50 shadow-[0_0_40px_rgba(251,113,133,0.16)]',
      borderGlow: 'group-hover:border-rose-200/45 group-hover:shadow-[0_30px_90px_rgba(244,63,94,0.18)]',
      buttonClass: 'group-hover:border-rose-200/60 group-hover:bg-rose-200 group-hover:text-rose-950',
      imageGlow: 'from-rose-200/35 via-pink-300/16 to-transparent',
      hoverText: 'group-hover:text-rose-50',
      spotlight: 'bg-[radial-gradient(circle_at_top_left,rgba(254,205,211,0.24),transparent_45%)]',
    } satisfies CardTone,
  },
] as const;

export default function Portal() {
  return (
    <div className="relative flex min-h-screen w-full overflow-x-hidden bg-[#050816] px-4 py-12 text-white selection:bg-sky-400/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_30%),radial-gradient(circle_at_85%_18%,rgba(251,191,36,0.1),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(244,63,94,0.08),transparent_28%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 mt-8 text-center md:mb-20 md:mt-16"
        >
          <div className="mb-5 flex flex-col items-center justify-center gap-3 md:flex-row md:gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/8 shadow-[0_20px_50px_rgba(56,189,248,0.18)] backdrop-blur-xl md:h-14 md:w-14">
              <Sparkles className="h-6 w-6 text-white md:h-7 md:w-7" />
            </div>
            <h1 className="bg-gradient-to-r from-white via-white to-white/45 bg-clip-text text-3xl font-black tracking-[-0.06em] text-transparent md:text-6xl">
              QUANGTHOAI RESTORE
            </h1>
          </div>

          <p className="px-4 text-[11px] font-medium uppercase tracking-[0.34em] text-white/45 md:text-sm">
            AI Photo Restoration Workspace
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/50 md:text-base">
            Chon khong gian lam viec phu hop cho tung loai anh. Moi card duoc thiet ke nhu mot lo trinh rieng, ro the loai ngay tu cai nhin dau tien.
          </p>
        </motion.div>

        <div className="mb-20 grid w-full grid-cols-1 gap-6 md:gap-8 xl:grid-cols-3">
          {cards.map((card, index) => {
            const Icon = card.icon;

            return (
              <motion.div
                key={card.to}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + index * 0.1, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link to={card.to} className="group block h-full">
                  <article
                    className={`relative flex h-full min-h-[430px] flex-col overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.045] p-1 backdrop-blur-xl transition-all duration-700 will-change-transform hover:-translate-y-2 ${card.tone.borderGlow}`}
                  >
                    <div className="absolute inset-0 opacity-70 transition-opacity duration-700 group-hover:opacity-100">
                      <img
                        src={card.bgImage}
                        alt={card.badge}
                        className="h-full w-full scale-105 object-cover opacity-20 saturate-[0.85] transition-all duration-700 group-hover:scale-110 group-hover:opacity-70 group-hover:saturate-100"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <div className={`absolute inset-0 opacity-70 transition-opacity duration-700 group-hover:opacity-100 ${card.tone.spotlight}`} />
                    <div className={`absolute inset-0 bg-gradient-to-br ${card.tone.imageGlow} opacity-50 blur-2xl transition-opacity duration-700 group-hover:opacity-90`} />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,22,0.18)_0%,rgba(5,8,22,0.58)_28%,rgba(5,8,22,0.92)_70%,rgba(5,8,22,0.98)_100%)] transition-all duration-700 group-hover:bg-[linear-gradient(180deg,rgba(5,8,22,0.08)_0%,rgba(5,8,22,0.42)_28%,rgba(5,8,22,0.8)_68%,rgba(5,8,22,0.96)_100%)]" />

                    <div className="relative flex h-full flex-col rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 md:p-8">
                      <div className="mb-10 flex items-start justify-between gap-4">
                        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border backdrop-blur-md transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 ${card.tone.iconClass}`}>
                          <Icon className="h-7 w-7" />
                        </div>

                        <span className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] backdrop-blur-md transition-all duration-500 group-hover:bg-white/12 ${card.tone.badgeClass}`}>
                          {card.badge}
                        </span>
                      </div>

                      <div className="space-y-4">
                        <h2 className={`max-w-[12ch] text-3xl font-semibold tracking-[-0.04em] text-white transition-colors duration-500 md:text-[2rem] ${card.tone.hoverText}`}>
                          {card.title}
                        </h2>
                        <p className="max-w-md text-sm leading-7 text-white/62 transition-colors duration-500 group-hover:text-white/84 md:text-[15px]">
                          {card.desc}
                        </p>
                      </div>

                      <div className="mt-auto pt-10">
                        <div className="mb-5 h-px w-full bg-gradient-to-r from-white/20 via-white/8 to-transparent" />

                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.28em] text-white/35">Workspace</p>
                            <p className={`mt-2 text-sm font-medium text-white/75 transition-colors duration-500 ${card.tone.hoverText}`}>
                              Chon luong xu ly phu hop
                            </p>
                          </div>

                          <div
                            className={`inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white/85 backdrop-blur-md transition-all duration-500 ${card.tone.buttonClass}`}
                          >
                            Mo ngay
                            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-auto pb-8 text-center text-[9px] uppercase tracking-[0.35em] text-white/20 md:text-[10px]"
        >
          © 2026 QUANGTHOAI RESTORE • Powered by Google Gemini AI
        </motion.p>
      </div>
    </div>
  );
}
