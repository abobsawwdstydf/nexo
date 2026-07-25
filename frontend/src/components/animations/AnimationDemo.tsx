import React, { useState } from 'react';
import {
  AnimatedHeart,
  AnimatedLike,
  AnimatedBookmark,
  AnimatedNotification,
  AnimatedSearch,
  AnimatedMenu,
  AnimatedSettings,
  AnimatedCheckmark,
  AnimatedShare,
  AnimatedCopy,
  AnimatedSend,
  AnimatedClose,
  AnimatedLock,
  AnimatedEye,
  AnimatedPlayPause,
  AnimatedVolume,
  AnimatedCalendar,
  AnimatedClock,
  AnimatedStar,
  AnimatedLoading,
  AnimatedThumbUp,
  AnimatedEdit,
  AnimatedTrash,
  AnimatedMail,
  AnimatedDownload,
  AnimatedVideo,
  AnimatedMicrophone,
  AnimatedGithub,
  AnimatedHome,
  AnimatedActivity,
} from './AnimatedIcons';
import {
  FadeIn,
  ScaleIn,
  SlideIn,
  StaggerList,
  HoverScale,
  Pulse,
  Bounce,
  Rotate,
  MorphIcon,
  AnimatedProgress,
  AnimatedNumber,
  AnimatedTooltip,
  AnimatedAccordion,
  AnimatedTabs,
} from './SpringAnimations';
import {
  AnimatedIconButton,
  AnimatedCard,
  AnimatedBadge,
  AnimatedToggle,
  AnimatedInput,
  AnimatedSkeleton,
  AnimatedLoadingDots,
} from './AnimatedUIComponents';
import {
  PageTransition,
  ScrollReveal,
  StaggerChildren,
  AnimatedModal,
  AnimatedToast,
} from './Transitions';
import { Heart, Star, Bell } from 'lucide-react';

export default function AnimationDemo() {
  const [activeTab, setActiveTab] = useState('icons');
  const [toggleValue, setToggleValue] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [progress, setProgress] = useState(65);
  const [showModal, setShowModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [heartActive, setHeartActive] = useState(false);

  const tabs = ['icons', 'components', 'transitions'];

  return (
    <div className="min-h-screen bg-surface p-8">
      <FadeIn>
        <h1 className="text-3xl font-bold text-white mb-8">
          Animation System Demo
        </h1>
      </FadeIn>

      <AnimatedTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="mb-8"
      />

      {activeTab === 'icons' && (
        <ScrollReveal>
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-4">
              Animated SVG Icons
            </h2>
            <div className="grid grid-cols-6 gap-4">
              <HoverScale>
                <AnimatedIconButton onClick={() => setHeartActive(!heartActive)}>
                  <AnimatedHeart size={24} className="text-red-500" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedLike size={24} className="text-blue-500" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedBookmark size={24} className="text-yellow-500" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedNotification size={24} className="text-green-500" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedSearch size={24} className="text-purple-500" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedMenu size={24} className="text-pink-500" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedSettings size={24} className="text-cyan-500" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedCheckmark size={24} className="text-emerald-500" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedShare size={24} className="text-indigo-500" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedCopy size={24} className="text-orange-500" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedSend size={24} className="text-teal-500" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedClose size={24} className="text-rose-500" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedStar size={24} className="text-amber-500" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedLock size={24} className="text-red-400" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedEye size={24} className="text-blue-400" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedPlayPause size={24} className="text-purple-400" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedVolume size={24} className="text-cyan-400" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedDownload size={24} className="text-sky-500" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedCalendar size={24} className="text-emerald-400" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedClock size={24} className="text-indigo-400" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedThumbUp size={24} className="text-orange-400" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedLoading size={24} className="text-lime-500" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedActivity size={24} className="text-fuchsia-500" />
                </AnimatedIconButton>
              </HoverScale>
              <HoverScale>
                <AnimatedIconButton>
                  <AnimatedMail size={24} className="text-teal-400" />
                </AnimatedIconButton>
              </HoverScale>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-4">
              Static Icons with Animations
            </h2>
            <div className="grid grid-cols-4 gap-4">
              <HoverScale>
                <AnimatedCard className="p-4 text-center">
                  <Pulse>
                    <Heart className="w-8 h-8 text-red-500 mx-auto" />
                  </Pulse>
                  <p className="text-sm text-gray-400 mt-2">Pulse</p>
                </AnimatedCard>
              </HoverScale>
              <HoverScale>
                <AnimatedCard className="p-4 text-center">
                  <Rotate>
                    <Star className="w-8 h-8 text-yellow-500 mx-auto" />
                  </Rotate>
                  <p className="text-sm text-gray-400 mt-2">Rotate</p>
                </AnimatedCard>
              </HoverScale>
              <HoverScale>
                <AnimatedCard className="p-4 text-center">
                  <Bounce>
                    <Bell className="w-8 h-8 text-green-500 mx-auto" />
                  </Bounce>
                  <p className="text-sm text-gray-400 mt-2">Bounce</p>
                </AnimatedCard>
              </HoverScale>
              <HoverScale>
                <AnimatedCard className="p-4 text-center">
                  <MorphIcon
                    from={<Heart className="w-8 h-8 text-gray-500" />}
                    to={<Heart className="w-8 h-8 text-red-500" />}
                    active={heartActive}
                  />
                  <p className="text-sm text-gray-400 mt-2">Morph</p>
                </AnimatedCard>
              </HoverScale>
            </div>
          </section>
        </ScrollReveal>
      )}

      {activeTab === 'components' && (
        <ScrollReveal>
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-4">
              Animated UI Components
            </h2>
            <div className="grid grid-cols-2 gap-6">
              <AnimatedCard className="p-6">
                <h3 className="text-lg font-medium text-white mb-4">Toggles</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Notifications</span>
                    <AnimatedToggle
                      checked={toggleValue}
                      onChange={setToggleValue}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Dark Mode</span>
                    <AnimatedToggle checked={true} onChange={() => {}} />
                  </div>
                </div>
              </AnimatedCard>

              <AnimatedCard className="p-6">
                <h3 className="text-lg font-medium text-white mb-4">Progress</h3>
                <div className="space-y-4">
                  <AnimatedProgress value={progress} />
                  <div className="flex gap-2">
                    <AnimatedIconButton
                      onClick={() => setProgress(Math.max(0, progress - 10))}
                    >
                      <span className="text-white">-</span>
                    </AnimatedIconButton>
                    <AnimatedIconButton
                      onClick={() => setProgress(Math.min(100, progress + 10))}
                    >
                      <span className="text-white">+</span>
                    </AnimatedIconButton>
                  </div>
                </div>
              </AnimatedCard>

              <AnimatedCard className="p-6">
                <h3 className="text-lg font-medium text-white mb-4">Input</h3>
                <AnimatedInput
                  value={inputValue}
                  onChange={setInputValue}
                  placeholder="Type something..."
                  icon={<AnimatedSearch size={18} />}
                />
              </AnimatedCard>

              <AnimatedCard className="p-6">
                <h3 className="text-lg font-medium text-white mb-4">Badges</h3>
                <div className="flex items-center gap-4">
                  <AnimatedBadge count={5} />
                  <AnimatedBadge count={99} />
                  <AnimatedBadge count={100} />
                  <AnimatedBadge dot />
                </div>
              </AnimatedCard>

              <AnimatedCard className="p-6">
                <h3 className="text-lg font-medium text-white mb-4">Loading</h3>
                <div className="flex items-center gap-4">
                  <AnimatedLoadingDots />
                  <AnimatedSkeleton width={100} height={20} />
                  <AnimatedSkeleton
                    width={40}
                    height={40}
                    variant="circular"
                  />
                </div>
              </AnimatedCard>

              <AnimatedCard className="p-6">
                <h3 className="text-lg font-medium text-white mb-4">
                  Animated Number
                </h3>
                <AnimatedNumber value={42} className="text-4xl font-bold text-nexo-500" />
              </AnimatedCard>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-4">
              Accordion
            </h2>
            <AnimatedAccordion title="What is this animation system?">
              <p className="text-gray-300">
                This is a comprehensive animation system built with CSS transitions,
                lucide-react icons, and Tailwind animations. It provides micro-animations,
                icon animations, and smooth transitions for your React applications.
              </p>
            </AnimatedAccordion>
          </section>
        </ScrollReveal>
      )}

      {activeTab === 'transitions' && (
        <ScrollReveal>
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-4">
              Page Transitions
            </h2>
            <div className="grid grid-cols-2 gap-6">
              <AnimatedCard className="p-6">
                <h3 className="text-lg font-medium text-white mb-4">
                  Modal
                </h3>
                <AnimatedIconButton onClick={() => setShowModal(true)}>
                  <span className="text-white">Open Modal</span>
                </AnimatedIconButton>
              </AnimatedCard>

              <AnimatedCard className="p-6">
                <h3 className="text-lg font-medium text-white mb-4">
                  Toast
                </h3>
                <AnimatedIconButton onClick={() => setShowToast(true)}>
                  <span className="text-white">Show Toast</span>
                </AnimatedIconButton>
              </AnimatedCard>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-4">
              Scroll Reveal (Scroll Down)
            </h2>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <ScrollReveal key={i} direction={i % 2 === 0 ? 'left' : 'right'}>
                  <AnimatedCard className="p-4">
                    <p className="text-gray-300">
                      Item {i} - Scroll to reveal this content
                    </p>
                  </AnimatedCard>
                </ScrollReveal>
              ))}
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-4">
              Stagger Children
            </h2>
            <StaggerChildren staggerDelay={100}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <AnimatedCard key={i} className="p-4 mb-2">
                  <p className="text-gray-300">Staggered Item {i}</p>
                </AnimatedCard>
              ))}
            </StaggerChildren>
          </section>
        </ScrollReveal>
      )}

      <AnimatedModal isOpen={showModal} onClose={() => setShowModal(false)}>
        <AnimatedCard className="p-6">
          <h3 className="text-xl font-semibold text-white mb-4">
            Animated Modal
          </h3>
          <p className="text-gray-300 mb-4">
            This modal uses CSS animations for smooth enter/exit transitions.
          </p>
          <AnimatedIconButton onClick={() => setShowModal(false)}>
            <AnimatedClose size={20} className="text-white" />
          </AnimatedIconButton>
        </AnimatedCard>
      </AnimatedModal>

      <AnimatedToast
        isVisible={showToast}
        message="This is an animated toast notification!"
        type="success"
        onClose={() => setShowToast(false)}
      />
    </div>
  );
}
