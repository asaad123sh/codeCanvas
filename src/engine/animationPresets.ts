/**
 * Animation preset library.
 *
 * The properties panel already exposes `animation-name`, `animation-duration`
 * and friends, but the builder shipped no keyframes to point them at, so those
 * fields were a dead end. This module is the missing half: a catalogue of ready
 * made keyframes grouped into categories (Fades, Flips, Rolls, Slides, ...).
 * Every entry is real CSS that actually animates.
 *
 * Rules
 * - `name` is a valid CSS custom-ident and globally unique.
 * - `keyframes` is the *body* of an `@keyframes` rule (the steps only).
 * - Exported HTML/CSS only ever carries the keyframes a design actually uses,
 *   so this file can stay large without bloating a generated site.
 *
 * Hover behaviour
 * - Most presets are one-shot: they are meant to play once (entry animations,
 *   attention animations, and so on) and then stay put.
 * - Hover-friendly presets are tagged with `iteration: 'infinite'` and live in
 *   categories whose names start with "Hover:". They are continuous animations
 *   (gentle float, breathe, glow, shimmer, soft wobble and the like) that keep
 *   going for as long as the element is hovered.
 * - The builder editor injects the whole catalogue, so these tiles play whenever
 *   the tile is hovered; an exported site still only carries the presets it
 *   actually references, so a design that does not use hover animations never
 *   pays for them.
 *
 * Count target
 * - This library is built to reach 200 named presets. When adding new ones,
 *   extend an existing category or add a new one and update `ANIMATION_CATEGORIES`
 *   discovering code (it is derived automatically, so only the category union and
 *   the `LIST` spread need to stay in sync).
 */

import type { ElementNode, StyleProps } from '../types';

export type AnimationCategory =
  | 'Fades'
  | 'Flips'
  | 'Rolls'
  | 'Slides'
  | 'Zooms'
  | 'Rotations'
  | 'Bounces'
  | 'Attention'
  | 'Elastic'
  | 'Swings'
  | 'Pops'
  | '3D'
  | 'Reveals'
  | 'Lights'
  | 'Loops'
  | 'Hover:Float'
  | 'Hover:Breathe'
  | 'Hover:Glow'
  | 'Hover:Shimmer'
  | 'Hover:Wobble'
  | 'Hover:Orbit'
  | 'Hover:Transform'
  | 'Hover:Speed'
  | 'Hover:Rubber'
  | 'Hover:Wave'
  | 'Hover:Twirl'
  | 'Hover:Magic'
  | 'Hover:Steam'
  | 'Hover:Frost'
  | 'Hover:Heat'
  | 'Hover:Ripple';
const IS_HOVER_CATEGORY = (category: AnimationCategory): boolean => category.startsWith('Hover:');

export interface AnimationPreset {
  /** CSS animation-name. Unique across the library. */
  name: string;
  /** Human label shown in the presets panel. */
  label: string;
  category: AnimationCategory;
  /** Steps of the @keyframes rule, e.g. "from{opacity:0}to{opacity:1}". */
  keyframes: string;
  duration: string;
  easing: string;
  iteration: string;
  delay: string;
  direction: string;
  fillMode: string;
}

/* ------------------------------------------------------------------ *
 * Tiny keyframe builders                                              *
 * ------------------------------------------------------------------ */

const from = (decls: string): string => `from{${decls}}`;
const to = (decls: string): string => `to{${decls}}`;
const at = (percent: number, decls: string): string => `${percent}%{${decls}}`;
/**
 * Joins keyframe steps. A leading step may be written as bare declarations
 * (`kf('transform:scale(1)', to(...))`) - it is promoted to a 0% stop, because a
 * declaration without a selector is not valid inside @keyframes and browsers
 * silently drop the whole rule.
 */
const kf = (...steps: string[]): string =>
  steps
    .map((step, index) => (index === 0 && !step.includes('{') ? at(0, step) : step))
    .join('');

/** Shorthand for "translate this far, fully faded". */
const off = (x: number, y: number): string =>
  `transform:translate3d(${x}px, ${y}px, 0);opacity:0`;

interface Draft {
  name: string;
  label: string;
  category: AnimationCategory;
  keyframes: string;
  duration?: string;
  easing?: string;
  iteration?: string;
  delay?: string;
  direction?: string;
  fillMode?: string;
}

const DEFAULTS = {
  duration: '0.6s',
  easing: 'ease',
  iteration: '1',
  delay: '0s',
  direction: 'normal',
  fillMode: 'both',
};

function preset(draft: Draft): AnimationPreset {
  return {
    name: draft.name,
    label: draft.label,
    category: draft.category,
    keyframes: draft.keyframes,
    duration: draft.duration || DEFAULTS.duration,
    easing: draft.easing || DEFAULTS.easing,
    iteration: draft.iteration || DEFAULTS.iteration,
    delay: draft.delay || DEFAULTS.delay,
    direction: draft.direction || DEFAULTS.direction,
    fillMode: draft.fillMode || DEFAULTS.fillMode,
  };
}

/* ------------------------------------------------------------------ *
 * Fades — 28                                                          *
 * ------------------------------------------------------------------ */

const FADES: Draft[] = [
  { name: 'fadeIn', label: 'Fade In', category: 'Fades', keyframes: kf(from('opacity:0'), to('opacity:1')) },
  { name: 'fadeInUp', label: 'Fade In Up', category: 'Fades', keyframes: kf(from(off(0, 24)), to('opacity:1;transform:none')) },
  { name: 'fadeInDown', label: 'Fade In Down', category: 'Fades', keyframes: kf(from(off(0, -24)), to('opacity:1;transform:none')) },
  { name: 'fadeInLeft', label: 'Fade In Left', category: 'Fades', keyframes: kf(from(off(-24, 0)), to('opacity:1;transform:none')) },
  { name: 'fadeInRight', label: 'Fade In Right', category: 'Fades', keyframes: kf(from(off(24, 0)), to('opacity:1;transform:none')) },
  { name: 'fadeOut', label: 'Fade Out', category: 'Fades', keyframes: kf(from('opacity:1'), to('opacity:0')), duration: '0.5s' },
  { name: 'fadeOutUp', label: 'Fade Out Up', category: 'Fades', duration: '0.5s', keyframes: kf(from('opacity:1'), to(off(0, -24))) },
  { name: 'fadeOutDown', label: 'Fade Out Down', category: 'Fades', duration: '0.5s', keyframes: kf(from('opacity:1'), to(off(0, 24))) },
  { name: 'fadeOutLeft', label: 'Fade Out Left', category: 'Fades', duration: '0.5s', keyframes: kf(from('opacity:1'), to(off(-24, 0))) },
  { name: 'fadeOutRight', label: 'Fade Out Right', category: 'Fades', duration: '0.5s', keyframes: kf(from('opacity:1'), to(off(24, 0))) },
  { name: 'fadeInBig', label: 'Fade In Big', category: 'Fades', keyframes: kf(from('opacity:0;transform:scale(0.6)'), to('opacity:1;transform:scale(1)')) },
  { name: 'fadeInBigUp', label: 'Fade In Big Up', category: 'Fades', keyframes: kf(from(off(0, 90)), to('opacity:1;transform:none')), duration: '0.9s', easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  { name: 'fadeInBigDown', label: 'Fade In Big Down', category: 'Fades', keyframes: kf(from(off(0, -90)), to('opacity:1;transform:none')), duration: '0.9s', easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  { name: 'fadeInBigLeft', label: 'Fade In Big Left', category: 'Fades', keyframes: kf(from(off(-90, 0)), to('opacity:1;transform:none')), duration: '0.9s', easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  { name: 'fadeInBigRight', label: 'Fade In Big Right', category: 'Fades', keyframes: kf(from(off(90, 0)), to('opacity:1;transform:none')), duration: '0.9s', easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  { name: 'fadeOutBig', label: 'Fade Out Big', category: 'Fades', duration: '0.6s', keyframes: kf(from('opacity:1;transform:scale(1)'), to('opacity:0;transform:scale(0.6)')) },
  { name: 'fadeOutBigUp', label: 'Fade Out Big Up', category: 'Fades', duration: '0.6s', keyframes: kf(from('opacity:1;transform:none'), to(off(0, -90))) },
  { name: 'fadeOutBigDown', label: 'Fade Out Big Down', category: 'Fades', duration: '0.6s', keyframes: kf(from('opacity:1;transform:none'), to(off(0, 90))) },
  { name: 'fadeOutBigLeft', label: 'Fade Out Big Left', category: 'Fades', duration: '0.6s', keyframes: kf(from('opacity:1;transform:none'), to(off(-90, 0))) },
  { name: 'fadeOutBigRight', label: 'Fade Out Big Right', category: 'Fades', duration: '0.6s', keyframes: kf(from('opacity:1;transform:none'), to(off(90, 0))) },
  { name: 'fadeInSoft', label: 'Fade In Soft', category: 'Fades', duration: '1.4s', easing: 'ease-in-out', keyframes: kf(from('opacity:0'), at(50, 'opacity:0.6'), to('opacity:1')) },
  { name: 'fadeOutSoft', label: 'Fade Out Soft', category: 'Fades', duration: '1.4s', easing: 'ease-in-out', keyframes: kf(from('opacity:1'), at(50, 'opacity:0.4'), to('opacity:0')) },
  { name: 'fadeInSlow', label: 'Fade In Slow', category: 'Fades', duration: '2s', easing: 'linear', keyframes: kf(from('opacity:0'), to('opacity:1')) },
  { name: 'fadeOutSlow', label: 'Fade Out Slow', category: 'Fades', duration: '2s', easing: 'linear', keyframes: kf(from('opacity:1'), to('opacity:0')) },
  { name: 'fadeInTop', label: 'Fade In Top', category: 'Fades', keyframes: kf(from(off(0, 48)), to('opacity:1;transform:none')), easing: 'ease-out' },
  { name: 'fadeInBottom', label: 'Fade In Bottom', category: 'Fades', keyframes: kf(from(off(0, -48)), to('opacity:1;transform:none')), easing: 'ease-out' },
  { name: 'fadeOutTop', label: 'Fade Out Top', category: 'Fades', duration: '0.5s', keyframes: kf(from('opacity:1'), to(off(0, -48))) },
  { name: 'fadeOutBottom', label: 'Fade Out Bottom', category: 'Fades', duration: '0.5s', keyframes: kf(from('opacity:1'), to(off(0, 48))) },
];

/* ------------------------------------------------------------------ *
 * Flips — 30                                                          *
 * ------------------------------------------------------------------ */

const FLIPS: Draft[] = [
  { name: 'flipInX', label: 'Flip In X', category: 'Flips', keyframes: kf(from('opacity:0;transform:perspective(400px) rotateX(-90deg)'), to('opacity:1;transform:perspective(400px) rotateX(0deg)')) },
  { name: 'flipOutX', label: 'Flip Out X', category: 'Flips', duration: '0.5s', keyframes: kf(from('opacity:1;transform:perspective(400px) rotateX(0deg)'), to('opacity:0;transform:perspective(400px) rotateX(90deg)')) },
  { name: 'flipInY', label: 'Flip In Y', category: 'Flips', keyframes: kf(from('opacity:0;transform:perspective(400px) rotateY(-90deg)'), to('opacity:1;transform:perspective(400px) rotateY(0deg)')) },
  { name: 'flipOutY', label: 'Flip Out Y', category: 'Flips', duration: '0.5s', keyframes: kf(from('opacity:1;transform:perspective(400px) rotateY(0deg)'), to('opacity:0;transform:perspective(400px) rotateY(90deg)')) },
  { name: 'flipInTop', label: 'Flip In Top', category: 'Flips', keyframes: kf(from('transform:perspective(400px) rotateX(90deg);transform-origin:50% 0'), to('transform:perspective(400px) rotateX(0deg);transform-origin:50% 0')) },
  { name: 'flipInRight', label: 'Flip In Right', category: 'Flips', keyframes: kf(from('transform:perspective(400px) rotateY(-90deg);transform-origin:100% 50%'), to('transform:perspective(400px) rotateY(0deg);transform-origin:100% 50%')) },
  { name: 'flipInBottom', label: 'Flip In Bottom', category: 'Flips', keyframes: kf(from('transform:perspective(400px) rotateX(-90deg);transform-origin:50% 100%'), to('transform:perspective(400px) rotateX(0deg);transform-origin:50% 100%')) },
  { name: 'flipInLeft', label: 'Flip In Left', category: 'Flips', keyframes: kf(from('transform:perspective(400px) rotateY(90deg);transform-origin:0 50%'), to('transform:perspective(400px) rotateY(0deg);transform-origin:0 50%')) },
  { name: 'flipOutTop', label: 'Flip Out Top', category: 'Flips', duration: '0.5s', keyframes: kf(from('transform:perspective(400px) rotateX(0deg);transform-origin:50% 0'), to('transform:perspective(400px) rotateX(-90deg);transform-origin:50% 0')) },
  { name: 'flipOutRight', label: 'Flip Out Right', category: 'Flips', duration: '0.5s', keyframes: kf(from('transform:perspective(400px) rotateY(0deg);transform-origin:100% 50%'), to('transform:perspective(400px) rotateY(90deg);transform-origin:100% 50%')) },
  { name: 'flipOutBottom', label: 'Flip Out Bottom', category: 'Flips', duration: '0.5s', keyframes: kf(from('transform:perspective(400px) rotateX(0deg);transform-origin:50% 100%'), to('transform:perspective(400px) rotateX(90deg);transform-origin:50% 100%')) },
  { name: 'flipOutLeft', label: 'Flip Out Left', category: 'Flips', duration: '0.5s', keyframes: kf(from('transform:perspective(400px) rotateY(0deg);transform-origin:0 50%'), to('transform:perspective(400px) rotateY(-90deg);transform-origin:0 50%')) },
  { name: 'flipInXUp', label: 'Flip In X Up', category: 'Flips', keyframes: kf(from('opacity:0;transform:perspective(500px) rotateX(-90deg) translate3d(0,-40px,0)'), to('opacity:1;transform:perspective(500px) rotateX(0deg) translate3d(0,0,0)')) },
  { name: 'flipInXDown', label: 'Flip In X Down', category: 'Flips', keyframes: kf(from('opacity:0;transform:perspective(500px) rotateX(90deg) translate3d(0,40px,0)'), to('opacity:1;transform:perspective(500px) rotateX(0deg) translate3d(0,0,0)')) },
  { name: 'flipOutXUp', label: 'Flip Out X Up', category: 'Flips', duration: '0.5s', keyframes: kf(from('opacity:1;transform:perspective(500px) rotateX(0deg) translate3d(0,0,0)'), to('opacity:0;transform:perspective(500px) rotateX(90deg) translate3d(0,-40px,0)')) },
  { name: 'flipOutXDown', label: 'Flip Out X Down', category: 'Flips', duration: '0.5s', keyframes: kf(from('opacity:1;transform:perspective(500px) rotateX(0deg) translate3d(0,0,0)'), to('opacity:0;transform:perspective(500px) rotateX(-90deg) translate3d(0,40px,0)')) },
  { name: 'flipInYLeft', label: 'Flip In Y Left', category: 'Flips', keyframes: kf(from('opacity:0;transform:perspective(500px) rotateY(-90deg) translate3d(-40px,0,0)'), to('opacity:1;transform:perspective(500px) rotateY(0deg) translate3d(0,0,0)')) },
  { name: 'flipInYRight', label: 'Flip In Y Right', category: 'Flips', keyframes: kf(from('opacity:0;transform:perspective(500px) rotateY(90deg) translate3d(40px,0,0)'), to('opacity:1;transform:perspective(500px) rotateY(0deg) translate3d(0,0,0)')) },
  { name: 'flipOutYLeft', label: 'Flip Out Y Left', category: 'Flips', duration: '0.5s', keyframes: kf(from('opacity:1;transform:perspective(500px) rotateY(0deg)'), to('opacity:0;transform:perspective(500px) rotateY(90deg) translate3d(-40px,0,0)')) },
  { name: 'flipOutYRight', label: 'Flip Out Y Right', category: 'Flips', duration: '0.5s', keyframes: kf(from('opacity:1;transform:perspective(500px) rotateY(0deg)'), to('opacity:0;transform:perspective(500px) rotateY(-90deg) translate3d(40px,0,0)')) },
  { name: 'flipClockwise', label: 'Flip Clockwise', category: 'Flips', duration: '0.8s', keyframes: kf(from('transform:perspective(400px) rotateY(0deg) scale3d(1,1,1);opacity:1'), at(50, 'transform:perspective(400px) rotateY(180deg) scale3d(1,1,1);opacity:0.4'), to('transform:perspective(400px) rotateY(360deg) scale3d(1,1,1);opacity:1')) },
  { name: 'flipCounterClockwise', label: 'Flip Counter Clockwise', category: 'Flips', duration: '0.8s', keyframes: kf(from('transform:perspective(400px) rotateY(0deg) scale3d(1,1,1);opacity:1'), at(50, 'transform:perspective(400px) rotateY(-180deg) scale3d(1,1,1);opacity:0.4'), to('transform:perspective(400px) rotateY(-360deg) scale3d(1,1,1);opacity:1')) },
  { name: 'flipHalfTurn', label: 'Flip Half Turn', category: 'Flips', duration: '0.9s', keyframes: kf(from('transform:perspective(600px) rotateY(0deg)'), at(50, 'transform:perspective(600px) rotateY(180deg) scaleX(-1)'), to('transform:perspective(600px) rotateY(360deg) scaleX(1)')) },
  { name: 'flipQuarterTurn', label: 'Flip Quarter Turn', category: 'Flips', duration: '0.6s', easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', keyframes: kf(from('transform:perspective(600px) rotateY(0deg) scale(1)'), to('transform:perspective(600px) rotateY(90deg) scale(1.08)')) },
  { name: 'flipInPerspective', label: 'Flip In Perspective', category: 'Flips', keyframes: kf(from('opacity:0;transform:perspective(1200px) rotateX(70deg) translateZ(-120px)'), to('opacity:1;transform:perspective(1200px) rotateX(0deg) translateZ(0)')) },
  { name: 'flipOutPerspective', label: 'Flip Out Perspective', category: 'Flips', duration: '0.6s', keyframes: kf(from('opacity:1;transform:perspective(1200px) rotateX(0deg) translateZ(0)'), to('opacity:0;transform:perspective(1200px) rotateX(-70deg) translateZ(-160px)')) },
  { name: 'flipIn3DTop', label: 'Flip In 3D Top', category: 'Flips', keyframes: kf(from('opacity:0;transform:perspective(800px) rotate3d(1,0,0,-80deg);transform-origin:50% 0'), to('opacity:1;transform:perspective(800px) rotate3d(1,0,0,0deg);transform-origin:50% 0')) },
  { name: 'flipIn3DBottom', label: 'Flip In 3D Bottom', category: 'Flips', keyframes: kf(from('opacity:0;transform:perspective(800px) rotate3d(1,0,0,80deg);transform-origin:50% 100%'), to('opacity:1;transform:perspective(800px) rotate3d(1,0,0,0deg);transform-origin:50% 100%')) },
  { name: 'flipOut3DTop', label: 'Flip Out 3D Top', category: 'Flips', duration: '0.5s', keyframes: kf(from('opacity:1;transform:perspective(800px) rotate3d(1,0,0,0deg);transform-origin:50% 0'), to('opacity:0;transform:perspective(800px) rotate3d(1,0,0,80deg);transform-origin:50% 0')) },
  { name: 'flipOut3DBottom', label: 'Flip Out 3D Bottom', category: 'Flips', duration: '0.5s', keyframes: kf(from('opacity:1;transform:perspective(800px) rotate3d(1,0,0,0deg);transform-origin:50% 100%'), to('opacity:0;transform:perspective(800px) rotate3d(1,0,0,-80deg);transform-origin:50% 100%')) },
];

/* ------------------------------------------------------------------ *
 * Rolls — 30                                                          *
 * ------------------------------------------------------------------ */

const ROLLS: Draft[] = [
  { name: 'rollIn', label: 'Roll In', category: 'Rolls', keyframes: kf(from('opacity:0;transform:translate3d(-200%,0,0) rotate(-360deg)'), to('opacity:1;transform:translate3d(0,0,0) rotate(0deg)')) },
  { name: 'rollOut', label: 'Roll Out', category: 'Rolls', duration: '0.5s', keyframes: kf(from('opacity:1;transform:translate3d(0,0,0) rotate(0deg)'), to('opacity:0;transform:translate3d(200%,0,0) rotate(360deg)')) },
  { name: 'rollInFromLeft', label: 'Roll In From Left', category: 'Rolls', keyframes: kf(from(off(-200, 0)), at(60, 'transform:translate3d(-6%,0,0) rotate(-12deg);opacity:0.9'), to('opacity:1;transform:translate3d(0,0,0) rotate(0deg)')) },
  { name: 'rollInFromRight', label: 'Roll In From Right', category: 'Rolls', keyframes: kf(from(off(200, 0)), at(60, 'transform:translate3d(6%,0,0) rotate(12deg);opacity:0.9'), to('opacity:1;transform:translate3d(0,0,0) rotate(0deg)')) },
  { name: 'rollInFromTop', label: 'Roll In From Top', category: 'Rolls', keyframes: kf(from(off(0, -200)), at(60, 'transform:translate3d(0,-6%,0) rotate(12deg);opacity:0.9'), to('opacity:1;transform:translate3d(0,0,0) rotate(0deg)')) },
  { name: 'rollInFromBottom', label: 'Roll In From Bottom', category: 'Rolls', keyframes: kf(from(off(0, 200)), at(60, 'transform:translate3d(0,6%,0) rotate(-12deg);opacity:0.9'), to('opacity:1;transform:translate3d(0,0,0) rotate(0deg)')) },
  { name: 'rollOutToLeft', label: 'Roll Out To Left', category: 'Rolls', duration: '0.5s', keyframes: kf(from('opacity:1;transform:translate3d(0,0,0) rotate(0deg)'), to('opacity:0;transform:translate3d(-200%,0,0) rotate(-360deg)')) },
  { name: 'rollOutToRight', label: 'Roll Out To Right', category: 'Rolls', duration: '0.5s', keyframes: kf(from('opacity:1;transform:translate3d(0,0,0) rotate(0deg)'), to('opacity:0;transform:translate3d(200%,0,0) rotate(360deg)')) },
  { name: 'rollOutToTop', label: 'Roll Out To Top', category: 'Rolls', duration: '0.5s', keyframes: kf(from('opacity:1;transform:translate3d(0,0,0) rotate(0deg)'), to('opacity:0;transform:translate3d(0,-200%,0) rotate(-360deg)')) },
  { name: 'rollOutToBottom', label: 'Roll Out To Bottom', category: 'Rolls', duration: '0.5s', keyframes: kf(from('opacity:1;transform:translate3d(0,0,0) rotate(0deg)'), to('opacity:0;transform:translate3d(0,200%,0) rotate(360deg)')) },
  { name: 'rollClockwise', label: 'Roll Clockwise', category: 'Rolls', duration: '0.8s', keyframes: kf(from('transform:rotate(0deg) translate3d(0,0,0)'), at(50, 'transform:rotate(180deg) translate3d(0,-30%,0)'), to('transform:rotate(360deg) translate3d(0,0,0)')) },
  { name: 'rollCounterClockwise', label: 'Roll Counter Clockwise', category: 'Rolls', duration: '0.8s', keyframes: kf(from('transform:rotate(0deg) translate3d(0,0,0)'), at(50, 'transform:rotate(-180deg) translate3d(0,-30%,0)'), to('transform:rotate(-360deg) translate3d(0,0,0)')) },
  { name: 'rollQuarter', label: 'Roll Quarter', category: 'Rolls', duration: '0.5s', easing: 'ease-out', keyframes: kf(from('transform:rotate(-90deg);opacity:0'), to('transform:rotate(0deg);opacity:1')) },
  { name: 'rollHalf', label: 'Roll Half', category: 'Rolls', duration: '0.8s', easing: 'cubic-bezier(0.4, 0, 0.2, 1)', keyframes: kf(from('transform:rotate(-180deg) scale(0.6);opacity:0'), to('transform:rotate(0deg) scale(1);opacity:1')) },
  { name: 'rollFull', label: 'Roll Full', category: 'Rolls', duration: '1s', easing: 'cubic-bezier(0.4, 0, 0.2, 1)', keyframes: kf(from('transform:rotate(-360deg) scale(0.4);opacity:0'), to('transform:rotate(0deg) scale(1);opacity:1')) },
  { name: 'rollUnroll', label: 'Roll Unroll', category: 'Rolls', duration: '0.7s', keyframes: kf(from('transform:rotate(720deg);opacity:0'), to('transform:rotate(0deg);opacity:1')) },
  { name: 'rollAround', label: 'Roll Around', category: 'Rolls', duration: '0.9s', keyframes: kf(from('transform:rotate(0deg)'), at(25, 'transform:rotate(-25deg)'), at(60, 'transform:rotate(300deg)'), to('transform:rotate(360deg)')) },
  { name: 'rollPage', label: 'Roll Page', category: 'Rolls', duration: '0.7s', keyframes: kf(from('transform:perspective(600px) rotateX(0deg) scale(1)'), at(50, 'transform:perspective(600px) rotateX(-90deg) scale(0.6);opacity:0.3'), to('transform:perspective(600px) rotateX(0deg) scale(1);opacity:1')) },
  { name: 'rollScroll', label: 'Roll Scroll', category: 'Rolls', duration: '0.8s', keyframes: kf(from('transform:rotate(-25deg) translate3d(-30%,0,0)'), to('transform:rotate(25deg) translate3d(30%,0,0)')) },
  { name: 'rollTiltLeft', label: 'Roll Tilt Left', category: 'Rolls', duration: '0.7s', keyframes: kf(from('transform:perspective(500px) rotateZ(-30deg);opacity:0'), to('transform:perspective(500px) rotateZ(0deg);opacity:1')) },
  { name: 'rollTiltRight', label: 'Roll Tilt Right', category: 'Rolls', duration: '0.7s', keyframes: kf(from('transform:perspective(500px) rotateZ(30deg);opacity:0'), to('transform:perspective(500px) rotateZ(0deg);opacity:1')) },
  { name: 'rollInLeftLittle', label: 'Roll In Left Little', category: 'Rolls', keyframes: kf(from(off(-60, 0)), to('opacity:1;transform:none')) },
  { name: 'rollInRightLittle', label: 'Roll In Right Little', category: 'Rolls', keyframes: kf(from(off(60, 0)), to('opacity:1;transform:none')) },
  { name: 'rollInUpLittle', label: 'Roll In Up Little', category: 'Rolls', keyframes: kf(from(off(0, -60)), to('opacity:1;transform:none')) },
  { name: 'rollInDownLittle', label: 'Roll In Down Little', category: 'Rolls', keyframes: kf(from(off(0, 60)), to('opacity:1;transform:none')) },
  { name: 'rollOutLeftLittle', label: 'Roll Out Left Little', category: 'Rolls', duration: '0.4s', keyframes: kf(from('opacity:1;transform:none'), to(off(-60, 0))) },
  { name: 'rollOutRightLittle', label: 'Roll Out Right Little', category: 'Rolls', duration: '0.4s', keyframes: kf(from('opacity:1;transform:none'), to(off(60, 0))) },
  { name: 'rollOutUpLittle', label: 'Roll Out Up Little', category: 'Rolls', duration: '0.4s', keyframes: kf(from('opacity:1;transform:none'), to(off(0, -60))) },
  { name: 'rollOutDownLittle', label: 'Roll Out Down Little', category: 'Rolls', duration: '0.4s', keyframes: kf(from('opacity:1;transform:none'), to(off(0, 60))) },
  { name: 'rollSettle', label: 'Roll Settle', category: 'Rolls', duration: '0.9s', easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.2)', keyframes: kf(from('transform:rotate(-12deg) translateY(-8px);opacity:0'), at(60, 'transform:rotate(3deg) translateY(2px);opacity:1'), to('transform:rotate(0deg) translateY(0);opacity:1')) },
];

/* ------------------------------------------------------------------ *
 * Slides — 28                                                         *
 * ------------------------------------------------------------------ */

const SLIDES: Draft[] = [
  { name: 'slideInFromLeft', label: 'Slide In From Left', category: 'Slides', keyframes: kf(from(off(-100, 0)), to('opacity:1;transform:none')), easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  { name: 'slideInFromRight', label: 'Slide In From Right', category: 'Slides', keyframes: kf(from(off(100, 0)), to('opacity:1;transform:none')), easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  { name: 'slideInFromTop', label: 'Slide In From Top', category: 'Slides', keyframes: kf(from(off(0, -100)), to('opacity:1;transform:none')), easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  { name: 'slideInFromBottom', label: 'Slide In From Bottom', category: 'Slides', keyframes: kf(from(off(0, 100)), to('opacity:1;transform:none')), easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  { name: 'slideOutToLeft', label: 'Slide Out To Left', category: 'Slides', duration: '0.5s', keyframes: kf(from('opacity:1;transform:none'), to(off(-100, 0))), easing: 'cubic-bezier(0.55, 0, 1, 0.45)' },
  { name: 'slideOutToRight', label: 'Slide Out To Right', category: 'Slides', duration: '0.5s', keyframes: kf(from('opacity:1;transform:none'), to(off(100, 0))), easing: 'cubic-bezier(0.55, 0, 1, 0.45)' },
  { name: 'slideOutToTop', label: 'Slide Out To Top', category: 'Slides', duration: '0.5s', keyframes: kf(from('opacity:1;transform:none'), to(off(0, -100))), easing: 'cubic-bezier(0.55, 0, 1, 0.45)' },
  { name: 'slideOutToBottom', label: 'Slide Out To Bottom', category: 'Slides', duration: '0.5s', keyframes: kf(from('opacity:1;transform:none'), to(off(0, 100))), easing: 'cubic-bezier(0.55, 0, 1, 0.45)' },
  { name: 'slideInFromTopLeft', label: 'Slide In Top Left', category: 'Slides', keyframes: kf(from(off(-80, -80)), to('opacity:1;transform:none')) },
  { name: 'slideInFromTopRight', label: 'Slide In Top Right', category: 'Slides', keyframes: kf(from(off(80, -80)), to('opacity:1;transform:none')) },
  { name: 'slideInFromBottomLeft', label: 'Slide In Bottom Left', category: 'Slides', keyframes: kf(from(off(-80, 80)), to('opacity:1;transform:none')) },
  { name: 'slideInFromBottomRight', label: 'Slide In Bottom Right', category: 'Slides', keyframes: kf(from(off(80, 80)), to('opacity:1;transform:none')) },
  { name: 'slideOutToTopLeft', label: 'Slide Out Top Left', category: 'Slides', duration: '0.5s', keyframes: kf(from('opacity:1;transform:none'), to(off(-80, -80))) },
  { name: 'slideOutToTopRight', label: 'Slide Out Top Right', category: 'Slides', duration: '0.5s', keyframes: kf(from('opacity:1;transform:none'), to(off(80, -80))) },
  { name: 'slideOutToBottomLeft', label: 'Slide Out Bottom Left', category: 'Slides', duration: '0.5s', keyframes: kf(from('opacity:1;transform:none'), to(off(-80, 80))) },
  { name: 'slideOutToBottomRight', label: 'Slide Out Bottom Right', category: 'Slides', duration: '0.5s', keyframes: kf(from('opacity:1;transform:none'), to(off(80, 80))) },
  { name: 'slideInFromLeftEdge', label: 'Slide In From Left Edge', category: 'Slides', duration: '0.7s', keyframes: kf(from('transform:translateX(-100vw);opacity:1'), to('transform:translateX(0);opacity:1')), easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  { name: 'slideInFromRightEdge', label: 'Slide In From Right Edge', category: 'Slides', duration: '0.7s', keyframes: kf(from('transform:translateX(100vw);opacity:1'), to('transform:translateX(0);opacity:1')), easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  { name: 'slideOutToLeftEdge', label: 'Slide Out To Left Edge', category: 'Slides', duration: '0.6s', keyframes: kf(from('transform:translateX(0)'), to('transform:translateX(-100vw)')), easing: 'cubic-bezier(0.7, 0, 0.84, 0)' },
  { name: 'slideOutToRightEdge', label: 'Slide Out To Right Edge', category: 'Slides', duration: '0.6s', keyframes: kf(from('transform:translateX(0)'), to('transform:translateX(100vw)')), easing: 'cubic-bezier(0.7, 0, 0.84, 0)' },
  { name: 'slideInFromLeftLittle', label: 'Slide In Left Little', category: 'Slides', keyframes: kf(from(off(-40, 0)), to('opacity:1;transform:none')) },
  { name: 'slideInFromRightLittle', label: 'Slide In Right Little', category: 'Slides', keyframes: kf(from(off(40, 0)), to('opacity:1;transform:none')) },
  { name: 'slideInFromUpLittle', label: 'Slide In Up Little', category: 'Slides', keyframes: kf(from(off(0, -40)), to('opacity:1;transform:none')) },
  { name: 'slideInFromDownLittle', label: 'Slide In Down Little', category: 'Slides', keyframes: kf(from(off(0, 40)), to('opacity:1;transform:none')) },
  { name: 'slideOutToLeftLittle', label: 'Slide Out Left Little', category: 'Slides', duration: '0.4s', keyframes: kf(from('opacity:1;transform:none'), to(off(-40, 0))) },
  { name: 'slideOutToRightLittle', label: 'Slide Out Right Little', category: 'Slides', duration: '0.4s', keyframes: kf(from('opacity:1;transform:none'), to(off(40, 0))) },
  { name: 'slideOutToUpLittle', label: 'Slide Out Up Little', category: 'Slides', duration: '0.4s', keyframes: kf(from('opacity:1;transform:none'), to(off(0, -40))) },
  { name: 'slideOutToDownLittle', label: 'Slide Out Down Little', category: 'Slides', duration: '0.4s', keyframes: kf(from('opacity:1;transform:none'), to(off(0, 40))) },
];

/* ------------------------------------------------------------------ *
 * Zooms — 24                                                          *
 * ------------------------------------------------------------------ */

const ZOOMS: Draft[] = [
  { name: 'zoomIn', label: 'Zoom In', category: 'Zooms', keyframes: kf(from('opacity:0;transform:scale3d(0.3,0.3,0.3)'), to('opacity:1;transform:scale3d(1,1,1)')) },
  { name: 'zoomOut', label: 'Zoom Out', category: 'Zooms', duration: '0.5s', keyframes: kf(from('opacity:1;transform:scale3d(1,1,1)'), to('opacity:0;transform:scale3d(0.3,0.3,0.3)')) },
  { name: 'zoomInUp', label: 'Zoom In Up', category: 'Zooms', keyframes: kf(from('opacity:0;transform:scale3d(0.3,0.3,0.3);transform-origin:50% 0'), to('opacity:1;transform:scale3d(1,1,1);transform-origin:50% 0')) },
  { name: 'zoomInDown', label: 'Zoom In Down', category: 'Zooms', keyframes: kf(from('opacity:0;transform:scale3d(0.3,0.3,0.3);transform-origin:50% 100%'), to('opacity:1;transform:scale3d(1,1,1);transform-origin:50% 100%')) },
  { name: 'zoomInLeft', label: 'Zoom In Left', category: 'Zooms', keyframes: kf(from('opacity:0;transform:scale3d(0.3,0.3,0.3);transform-origin:0 50%'), to('opacity:1;transform:scale3d(1,1,1);transform-origin:0 50%')) },
  { name: 'zoomInRight', label: 'Zoom In Right', category: 'Zooms', keyframes: kf(from('opacity:0;transform:scale3d(0.3,0.3,0.3);transform-origin:100% 50%'), to('opacity:1;transform:scale3d(1,1,1);transform-origin:100% 50%')) },
  { name: 'zoomOutUp', label: 'Zoom Out Up', category: 'Zooms', duration: '0.5s', keyframes: kf(from('opacity:1;transform:scale3d(1,1,1);transform-origin:50% 0'), to('opacity:0;transform:scale3d(0.3,0.3,0.3);transform-origin:50% 0')) },
  { name: 'zoomOutDown', label: 'Zoom Out Down', category: 'Zooms', duration: '0.5s', keyframes: kf(from('opacity:1;transform:scale3d(1,1,1);transform-origin:50% 100%'), to('opacity:0;transform:scale3d(0.3,0.3,0.3);transform-origin:50% 100%')) },
  { name: 'zoomOutLeft', label: 'Zoom Out Left', category: 'Zooms', duration: '0.5s', keyframes: kf(from('opacity:1;transform:scale3d(1,1,1);transform-origin:0 50%'), to('opacity:0;transform:scale3d(0.3,0.3,0.3);transform-origin:0 50%')) },
  { name: 'zoomOutRight', label: 'Zoom Out Right', category: 'Zooms', duration: '0.5s', keyframes: kf(from('opacity:1;transform:scale3d(1,1,1);transform-origin:100% 50%'), to('opacity:0;transform:scale3d(0.3,0.3,0.3);transform-origin:100% 50%')) },
  { name: 'zoomInBig', label: 'Zoom In Big', category: 'Zooms', duration: '0.9s', easing: 'cubic-bezier(0.22, 1, 0.36, 1)', keyframes: kf(from('opacity:0;transform:scale3d(0,0,0)'), to('opacity:1;transform:scale3d(1,1,1)')) },
  { name: 'zoomOutBig', label: 'Zoom Out Big', category: 'Zooms', duration: '0.9s', easing: 'cubic-bezier(0.22, 1, 0.36, 1)', keyframes: kf(from('opacity:1;transform:scale3d(1,1,1)'), to('opacity:0;transform:scale3d(0,0,0)')) },
  { name: 'zoomInSoft', label: 'Zoom In Soft', category: 'Zooms', duration: '1s', easing: 'ease-out', keyframes: kf(from('opacity:0;transform:scale3d(0.85,0.85,0.85)'), to('opacity:1;transform:scale3d(1,1,1)')) },
  { name: 'zoomOutSoft', label: 'Zoom Out Soft', category: 'Zooms', duration: '1s', easing: 'ease-out', keyframes: kf(from('opacity:1;transform:scale3d(1,1,1)'), to('opacity:0;transform:scale3d(0.85,0.85,0.85)')) },
  { name: 'zoomInTiny', label: 'Zoom In Tiny', category: 'Zooms', duration: '0.4s', keyframes: kf(from('opacity:0;transform:scale3d(0.7,0.7,0.7)'), to('opacity:1;transform:scale3d(1,1,1)')) },
  { name: 'zoomOutTiny', label: 'Zoom Out Tiny', category: 'Zooms', duration: '0.4s', keyframes: kf(from('opacity:1;transform:scale3d(1,1,1)'), to('opacity:0;transform:scale3d(0.7,0.7,0.7)')) },
  { name: 'zoomIn3D', label: 'Zoom In 3D', category: 'Zooms', keyframes: kf(from('opacity:0;transform:perspective(500px) translate3d(0,0,-300px)'), to('opacity:1;transform:perspective(500px) translate3d(0,0,0)')) },
  { name: 'zoomOut3D', label: 'Zoom Out 3D', category: 'Zooms', duration: '0.6s', keyframes: kf(from('opacity:1;transform:perspective(500px) translate3d(0,0,0)'), to('opacity:0;transform:perspective(500px) translate3d(0,0,-300px)')) },
  { name: 'zoomInScreen', label: 'Zoom In Screen', category: 'Zooms', duration: '0.8s', keyframes: kf(from('opacity:0;transform:scale3d(2,2,2)'), to('opacity:1;transform:scale3d(1,1,1)')) },
  { name: 'zoomOutScreen', label: 'Zoom Out Screen', category: 'Zooms', duration: '0.8s', keyframes: kf(from('opacity:1;transform:scale3d(1,1,1)'), to('opacity:0;transform:scale3d(2,2,2)')) },
  { name: 'zoomInSpin', label: 'Zoom In Spin', category: 'Zooms', duration: '0.8s', keyframes: kf(from('opacity:0;transform:scale3d(0.3,0.3,0.3) rotate(-90deg)'), to('opacity:1;transform:scale3d(1,1,1) rotate(0deg)')) },
  { name: 'zoomOutSpin', label: 'Zoom Out Spin', category: 'Zooms', duration: '0.8s', keyframes: kf(from('opacity:1;transform:scale3d(1,1,1) rotate(0deg)'), to('opacity:0;transform:scale3d(0.3,0.3,0.3) rotate(90deg)')) },
  { name: 'zoomBounce', label: 'Zoom Bounce', category: 'Zooms', duration: '0.9s', keyframes: kf(from('opacity:0;transform:scale3d(0.2,0.2,0.2)'), at(50, 'opacity:1;transform:scale3d(1.15,1.15,1.15)'), at(75, 'transform:scale3d(0.92,0.92,0.92)'), to('opacity:1;transform:scale3d(1,1,1)')) },
  { name: 'zoomPulse', label: 'Zoom Pulse', category: 'Zooms', duration: '1.2s', iteration: 'infinite', keyframes: kf(from('transform:scale(1)'), at(50, 'transform:scale(1.08)'), to('transform:scale(1)')) },
];

/* ------------------------------------------------------------------ *
 * Rotations — 24                                                      *
 * ------------------------------------------------------------------ */

const ROTATIONS: Draft[] = [
  { name: 'rotateIn', label: 'Rotate In', category: 'Rotations', keyframes: kf(from('opacity:0;transform-origin:center;transform:rotate(-200deg)'), to('opacity:1;transform-origin:center;transform:rotate(0deg)')) },
  { name: 'rotateOut', label: 'Rotate Out', category: 'Rotations', duration: '0.5s', keyframes: kf(from('opacity:1;transform-origin:center;transform:rotate(0deg)'), to('opacity:0;transform-origin:center;transform:rotate(200deg)')) },
  { name: 'rotateInUpLeft', label: 'Rotate In Up Left', category: 'Rotations', keyframes: kf(from('opacity:0;transform-origin:left bottom;transform:rotate(-90deg)'), to('opacity:1;transform-origin:left bottom;transform:rotate(0deg)')) },
  { name: 'rotateInUpRight', label: 'Rotate In Up Right', category: 'Rotations', keyframes: kf(from('opacity:0;transform-origin:right bottom;transform:rotate(90deg)'), to('opacity:1;transform-origin:right bottom;transform:rotate(0deg)')) },
  { name: 'rotateInDownLeft', label: 'Rotate In Down Left', category: 'Rotations', keyframes: kf(from('opacity:0;transform-origin:left top;transform:rotate(90deg)'), to('opacity:1;transform-origin:left top;transform:rotate(0deg)')) },
  { name: 'rotateInDownRight', label: 'Rotate In Down Right', category: 'Rotations', keyframes: kf(from('opacity:0;transform-origin:right top;transform:rotate(-90deg)'), to('opacity:1;transform-origin:right top;transform:rotate(0deg)')) },
  { name: 'rotateOutUpLeft', label: 'Rotate Out Up Left', category: 'Rotations', duration: '0.5s', keyframes: kf(from('opacity:1;transform-origin:left bottom;transform:rotate(0deg)'), to('opacity:0;transform-origin:left bottom;transform:rotate(-90deg)')) },
  { name: 'rotateOutUpRight', label: 'Rotate Out Up Right', category: 'Rotations', duration: '0.5s', keyframes: kf(from('opacity:1;transform-origin:right bottom;transform:rotate(0deg)'), to('opacity:0;transform-origin:right bottom;transform:rotate(90deg)')) },
  { name: 'rotateOutDownLeft', label: 'Rotate Out Down Left', category: 'Rotations', duration: '0.5s', keyframes: kf(from('opacity:1;transform-origin:left top;transform:rotate(0deg)'), to('opacity:0;transform-origin:left top;transform:rotate(90deg)')) },
  { name: 'rotateOutDownRight', label: 'Rotate Out Down Right', category: 'Rotations', duration: '0.5s', keyframes: kf(from('opacity:1;transform-origin:right top;transform:rotate(0deg)'), to('opacity:0;transform-origin:right top;transform:rotate(-90deg)')) },
  { name: 'rotateClockwise', label: 'Rotate Clockwise', category: 'Rotations', duration: '0.9s', keyframes: kf(from('transform:rotate(0deg)'), to('transform:rotate(360deg)')) },
  { name: 'rotateCounterClockwise', label: 'Rotate Counter Clockwise', category: 'Rotations', duration: '0.9s', keyframes: kf(from('transform:rotate(0deg)'), to('transform:rotate(-360deg)')) },
  { name: 'rotateQuarter', label: 'Rotate Quarter', category: 'Rotations', duration: '0.6s', keyframes: kf(from('transform:rotate(-90deg);opacity:0.4'), to('transform:rotate(0deg);opacity:1')) },
  { name: 'rotateHalf', label: 'Rotate Half', category: 'Rotations', duration: '0.9s', keyframes: kf(from('transform:rotate(-180deg);opacity:0'), to('transform:rotate(0deg);opacity:1')) },
  { name: 'rotateFull', label: 'Rotate Full', category: 'Rotations', duration: '1.2s', keyframes: kf(from('transform:rotate(-360deg);opacity:0'), to('transform:rotate(0deg);opacity:1')) },
  { name: 'rotateWobble', label: 'Rotate Wobble', category: 'Rotations', duration: '0.8s', keyframes: kf(from('transform:rotate(-12deg)'), at(40, 'transform:rotate(8deg)'), at(70, 'transform:rotate(-4deg)'), to('transform:rotate(0deg)')) },
  { name: 'rotateShake', label: 'Rotate Shake', category: 'Rotations', duration: '0.6s', keyframes: kf(from('transform:rotate(-3deg)'), at(25, 'transform:rotate(3deg)'), at(50, 'transform:rotate(-2deg)'), at(75, 'transform:rotate(2deg)'), to('transform:rotate(0deg)')) },
  { name: 'rotateSkew', label: 'Rotate Skew', category: 'Rotations', duration: '0.8s', keyframes: kf(from('transform:skewX(-20deg) rotate(-6deg);opacity:0'), to('transform:skewX(0deg) rotate(0deg);opacity:1')) },
  { name: 'rotateIn3D', label: 'Rotate In 3D', category: 'Rotations', keyframes: kf(from('opacity:0;transform:perspective(600px) rotate3d(1,1,0,120deg)'), to('opacity:1;transform:perspective(600px) rotate3d(1,1,0,0deg)')) },
  { name: 'rotateOut3D', label: 'Rotate Out 3D', category: 'Rotations', duration: '0.6s', keyframes: kf(from('opacity:1;transform:perspective(600px) rotate3d(1,1,0,0deg)'), to('opacity:0;transform:perspective(600px) rotate3d(1,1,0,120deg)')) },
  { name: 'rotateFlipX', label: 'Rotate Flip X', category: 'Rotations', duration: '0.7s', keyframes: kf(from('transform:perspective(500px) rotateX(90deg);opacity:0'), to('transform:perspective(500px) rotateX(0deg);opacity:1')) },
  { name: 'rotateFlipY', label: 'Rotate Flip Y', category: 'Rotations', duration: '0.7s', keyframes: kf(from('transform:perspective(500px) rotateY(90deg);opacity:0'), to('transform:perspective(500px) rotateY(0deg);opacity:1')) },
  { name: 'orbitSpin', label: 'Orbit Spin', category: 'Rotations', duration: '1.4s', iteration: 'infinite', keyframes: kf(from('transform:rotate(0deg) translateX(10px)'), to('transform:rotate(360deg) translateX(10px)')) },
  { name: 'reverseSpin', label: 'Reverse Spin', category: 'Rotations', duration: '1.4s', iteration: 'infinite', keyframes: kf(from('transform:rotate(360deg)'), to('transform:rotate(0deg)')) },
];

/* ------------------------------------------------------------------ *
 * Bounces — 18                                                        *
 * ------------------------------------------------------------------ */

const BOUNCES: Draft[] = [
  { name: 'bounceIn', label: 'Bounce In', category: 'Bounces', duration: '0.9s', easing: 'cubic-bezier(0.28, 0.84, 0.42, 1)', keyframes: kf(from('opacity:0;transform:scale(0.3)'), at(45, 'transform:scale(1.06)'), at(70, 'transform:scale(0.94)'), to('opacity:1;transform:scale(1)')) },
  { name: 'bounceOut', label: 'Bounce Out', category: 'Bounces', duration: '0.7s', easing: 'cubic-bezier(0.28, 0.84, 0.42, 1)', keyframes: kf(from('opacity:1;transform:scale(1)'), at(25, 'transform:scale(1.08)'), at(55, 'transform:scale(0.92)'), to('opacity:0;transform:scale(0.3)')) },
  { name: 'bounceInUp', label: 'Bounce In Up', category: 'Bounces', duration: '0.9s', keyframes: kf(from('opacity:0;transform:translateY(90%) scale(0.6)'), at(50, 'transform:translateY(-10%) scale(1.04)'), at(75, 'transform:translateY(4%) scale(0.98)'), to('opacity:1;transform:translateY(0) scale(1)')) },
  { name: 'bounceInDown', label: 'Bounce In Down', category: 'Bounces', duration: '0.9s', keyframes: kf(from('opacity:0;transform:translateY(-90%) scale(0.6)'), at(50, 'transform:translateY(10%) scale(1.04)'), at(75, 'transform:translateY(-4%) scale(0.98)'), to('opacity:1;transform:translateY(0) scale(1)')) },
  { name: 'bounceInLeft', label: 'Bounce In Left', category: 'Bounces', duration: '0.9s', keyframes: kf(from('opacity:0;transform:translateX(-90%) scale(0.6)'), at(50, 'transform:translateX(10%) scale(1.04)'), at(75, 'transform:translateX(-4%) scale(0.98)'), to('opacity:1;transform:translateX(0) scale(1)')) },
  { name: 'bounceInRight', label: 'Bounce In Right', category: 'Bounces', duration: '0.9s', keyframes: kf(from('opacity:0;transform:translateX(90%) scale(0.6)'), at(50, 'transform:translateX(-10%) scale(1.04)'), at(75, 'transform:translateX(4%) scale(0.98)'), to('opacity:1;transform:translateX(0) scale(1)')) },
  { name: 'bounceOutUp', label: 'Bounce Out Up', category: 'Bounces', duration: '0.7s', keyframes: kf(from('opacity:1;transform:translateY(0) scale(1)'), at(50, 'transform:translateY(-12%) scale(1.02)'), to('opacity:0;transform:translateY(-90%) scale(0.5)')) },
  { name: 'bounceOutDown', label: 'Bounce Out Down', category: 'Bounces', duration: '0.7s', keyframes: kf(from('opacity:1;transform:translateY(0) scale(1)'), at(50, 'transform:translateY(12%) scale(1.02)'), to('opacity:0;transform:translateY(90%) scale(0.5)')) },
  { name: 'bounceOutLeft', label: 'Bounce Out Left', category: 'Bounces', duration: '0.7s', keyframes: kf(from('opacity:1;transform:translateX(0) scale(1)'), at(50, 'transform:translateX(-12%) scale(1.02)'), to('opacity:0;transform:translateX(-90%) scale(0.5)')) },
  { name: 'bounceOutRight', label: 'Bounce Out Right', category: 'Bounces', duration: '0.7s', keyframes: kf(from('opacity:1;transform:translateX(0) scale(1)'), at(50, 'transform:translateX(12%) scale(1.02)'), to('opacity:0;transform:translateX(90%) scale(0.5)')) },
  { name: 'bounceInTop', label: 'Bounce In Top', category: 'Bounces', duration: '1s', keyframes: kf(from('opacity:0;transform:translateY(-100%) rotateX(-70deg)'), at(60, 'transform:translateY(8%) rotateX(8deg);opacity:1'), to('opacity:1;transform:translateY(0) rotateX(0deg)')) },
  { name: 'bounceOutBottom', label: 'Bounce Out Bottom', category: 'Bounces', duration: '0.8s', keyframes: kf(from('opacity:1;transform:translateY(0) rotateX(0deg)'), at(40, 'transform:translateY(10%) rotateX(10deg)'), to('opacity:0;transform:translateY(100%) rotateX(-70deg)')) },
  { name: 'bounceLand', label: 'Bounce Land', category: 'Bounces', duration: '0.8s', keyframes: kf(from('opacity:0;transform:translateY(-40px) scaleY(0.8)'), at(30, 'transform:translateY(0) scaleY(1.12)'), at(50, 'transform:translateY(0) scaleY(0.94)'), to('opacity:1;transform:translateY(0) scaleY(1)')) },
  { name: 'bounceLandSoft', label: 'Bounce Land Soft', category: 'Bounces', duration: '0.9s', keyframes: kf(from('opacity:0;transform:translateY(-20px) scaleY(0.95)'), to('opacity:1;transform:translateY(0) scaleY(1)')) },
  { name: 'bounceSettle', label: 'Bounce Settle', category: 'Bounces', duration: '1.1s', keyframes: kf(from('transform:translateY(-30px) scale(0.9);opacity:0'), at(40, 'transform:translateY(0) scale(1.05)'), at(60, 'transform:translateY(-6px) scale(0.99)'), at(80, 'transform:translateY(2px) scale(1.01)'), to('transform:translateY(0) scale(1);opacity:1')) },
  { name: 'bounceTilt', label: 'Bounce Tilt', category: 'Bounces', duration: '0.8s', keyframes: kf(from('opacity:0;transform:rotate(-8deg) translateY(-20px)'), at(60, 'transform:rotate(3deg) translateY(0)'), to('opacity:1;transform:rotate(0deg) translateY(0)')) },
  { name: 'bounceDropIn', label: 'Bounce Drop In', category: 'Bounces', duration: '0.8s', keyframes: kf(from('opacity:0;transform:translateY(-120px)'), at(70, 'transform:translateY(6px);opacity:1'), to('opacity:1;transform:translateY(0)')) },
  { name: 'bounceDropOut', label: 'Bounce Drop Out', category: 'Bounces', duration: '0.7s', keyframes: kf(from('opacity:1;transform:translateY(0)'), to('opacity:0;transform:translateY(120px)')) },
];

/* ------------------------------------------------------------------ *
 * Attention — 30                                                      *
 * ------------------------------------------------------------------ */

const ATTENTION: Draft[] = [
  { name: 'pulse', label: 'Pulse', category: 'Attention', duration: '1.2s', iteration: 'infinite', keyframes: kf(at(0, 'transform:scale(1)'), at(50, 'transform:scale(1.06)'), at(100, 'transform:scale(1)')) },
  { name: 'pulseGrow', label: 'Pulse Grow', category: 'Attention', duration: '1.2s', iteration: 'infinite', keyframes: kf(from('transform:scale(1)'), to('transform:scale(1.15)')) },
  { name: 'pulseShrink', label: 'Pulse Shrink', category: 'Attention', duration: '1.2s', iteration: 'infinite', keyframes: kf(from('transform:scale(1.12)'), to('transform:scale(1)')) },
  { name: 'pulseSoft', label: 'Pulse Soft', category: 'Attention', duration: '2.4s', iteration: 'infinite', easing: 'ease-in-out', keyframes: kf(from('opacity:1;transform:scale(1)'), at(50, 'opacity:0.75;transform:scale(1.04)'), to('opacity:1;transform:scale(1)')) },
  { name: 'heartbeat', label: 'Heartbeat', category: 'Attention', duration: '1.4s', iteration: 'infinite', keyframes: kf('transform:scale(1)', at(14, 'transform:scale(1.15)'), at(28, 'transform:scale(1)'), at(42, 'transform:scale(1.15)'), at(70, 'transform:scale(1)'), at(100, 'transform:scale(1)')) },
  { name: 'flash', label: 'Flash', category: 'Attention', duration: '0.8s', iteration: 'infinite', keyframes: kf('opacity:1', at(20, 'opacity:0'), at(40, 'opacity:1'), at(60, 'opacity:0'), at(80, 'opacity:1'), at(100, 'opacity:1')) },
  { name: 'blink', label: 'Blink', category: 'Attention', duration: '1s', iteration: 'infinite', keyframes: kf('opacity:1', at(45, 'opacity:0'), at(50, 'opacity:0'), at(55, 'opacity:1'), at(100, 'opacity:1')) },
  { name: 'shakeLeft', label: 'Shake Left', category: 'Attention', duration: '0.6s', keyframes: kf(at(0, 'transform:translateX(0)'), at(20, 'transform:translateX(-12px)'), at(40, 'transform:translateX(10px)'), at(60, 'transform:translateX(-7px)'), at(80, 'transform:translateX(4px)'), at(100, 'transform:translateX(0)')) },
  { name: 'shakeRight', label: 'Shake Right', category: 'Attention', duration: '0.6s', keyframes: kf(at(0, 'transform:translateX(0)'), at(20, 'transform:translateX(12px)'), at(40, 'transform:translateX(-10px)'), at(60, 'transform:translateX(7px)'), at(80, 'transform:translateX(-4px)'), at(100, 'transform:translateX(0)')) },
  { name: 'shakeTop', label: 'Shake Top', category: 'Attention', duration: '0.6s', keyframes: kf(at(0, 'transform:translateY(0)'), at(20, 'transform:translateY(-12px)'), at(40, 'transform:translateY(10px)'), at(60, 'transform:translateY(-7px)'), at(80, 'transform:translateY(4px)'), at(100, 'transform:translateY(0)')) },
  { name: 'shakeBottom', label: 'Shake Bottom', category: 'Attention', duration: '0.6s', keyframes: kf(at(0, 'transform:translateY(0)'), at(20, 'transform:translateY(12px)'), at(40, 'transform:translateY(-10px)'), at(60, 'transform:translateY(7px)'), at(80, 'transform:translateY(-4px)'), at(100, 'transform:translateY(0)')) },
  { name: 'shakeX', label: 'Shake X', category: 'Attention', duration: '0.5s', keyframes: kf(at(0, 'transform:translateX(0)'), at(25, 'transform:translateX(-8px)'), at(50, 'transform:translateX(8px)'), at(75, 'transform:translateX(-4px)'), at(100, 'transform:translateX(0)')) },
  { name: 'shakeY', label: 'Shake Y', category: 'Attention', duration: '0.5s', keyframes: kf(at(0, 'transform:translateY(0)'), at(25, 'transform:translateY(-8px)'), at(50, 'transform:translateY(8px)'), at(75, 'transform:translateY(-4px)'), at(100, 'transform:translateY(0)')) },
  { name: 'wobble', label: 'Wobble', category: 'Attention', duration: '1s', keyframes: kf(at(0, 'transform:translateX(0)'), at(25, 'transform:translateX(-14px) rotate(-6deg)'), at(50, 'transform:translateX(10px) rotate(4deg)'), at(75, 'transform:translateX(-6px) rotate(-2deg)'), at(100, 'transform:translateX(0)')) },
  { name: 'wobbleSkelly', label: 'Wobble Skelly', category: 'Attention', duration: '1.1s', keyframes: kf(at(0, 'transform:translateX(0) rotate(0deg)'), at(25, 'transform:translateX(-12px) rotate(-8deg)'), at(50, 'transform:translateX(9px) rotate(6deg)'), at(75, 'transform:translateX(-5px) rotate(-3deg)'), at(100, 'transform:translateX(0) rotate(0deg)')) },
  { name: 'wobbleSkew', label: 'Wobble Skew', category: 'Attention', duration: '1s', keyframes: kf(at(0, 'transform:skewX(0deg)'), at(30, 'transform:skewX(-14deg) translateX(-8px)'), at(60, 'transform:skewX(10deg) translateX(6px)'), at(100, 'transform:skewX(0deg) translateX(0)')) },
  { name: 'wobbleHard', label: 'Wobble Hard', category: 'Attention', duration: '0.7s', keyframes: kf(at(0, 'transform:translate3d(0,0,0)'), at(20, 'transform:translate3d(-16px,0,0) rotate(-8deg)'), at(40, 'transform:translate3d(14px,0,0) rotate(8deg)'), at(60, 'transform:translate3d(-10px,0,0) rotate(-4deg)'), at(100, 'transform:translate3d(0,0,0) rotate(0deg)')) },
  { name: 'vibrate', label: 'Vibrate', category: 'Attention', duration: '0.4s', keyframes: kf(at(0, 'transform:translate(0)'), at(25, 'transform:translate(-2px,1px)'), at(50, 'transform:translate(2px,-1px)'), at(75, 'transform:translate(-1px,-2px)'), at(100, 'transform:translate(0)')) },
  { name: 'vibrateHard', label: 'Vibrate Hard', category: 'Attention', duration: '0.35s', keyframes: kf(at(0, 'transform:translate(0,0) rotate(0deg)'), at(20, 'transform:translate(-5px,3px) rotate(-2deg)'), at(40, 'transform:translate(5px,-3px) rotate(2deg)'), at(60, 'transform:translate(-4px,-2px) rotate(-1deg)'), at(80, 'transform:translate(4px,2px) rotate(1deg)'), at(100, 'transform:translate(0,0) rotate(0deg)')) },
  { name: 'buzz', label: 'Buzz', category: 'Attention', duration: '0.5s', keyframes: kf(at(0, 'transform:translate(0,0) scale(1)'), at(20, 'transform:translate(-4px,2px) scale(1.04)'), at(40, 'transform:translate(4px,-2px) scale(0.98)'), at(60, 'transform:translate(-3px,-1px) scale(1.02)'), at(80, 'transform:translate(3px,1px) scale(1)'), at(100, 'transform:translate(0,0) scale(1)')) },
  { name: 'buzzOut', label: 'Buzz Out', category: 'Attention', duration: '0.5s', keyframes: kf(at(0, 'transform:translate(0,0) scale(1)'), at(30, 'transform:translate(-6px,0) scale(1.08)'), at(60, 'transform:translate(6px,0) scale(0.94)'), at(100, 'transform:translate(0,0) scale(1)')) },
  { name: 'ring', label: 'Ring', category: 'Attention', duration: '1.2s', iteration: 'infinite', keyframes: kf(at(0, 'box-shadow:0 0 0 0 rgba(59,130,246,0.5)'), at(70, 'box-shadow:0 0 0 16px rgba(59,130,246,0)'), at(100, 'box-shadow:0 0 0 0 rgba(59,130,246,0)')) },
  { name: 'ringSoft', label: 'Ring Soft', category: 'Attention', duration: '2s', iteration: 'infinite', easing: 'ease-out', keyframes: kf(at(0, 'box-shadow:0 0 0 0 rgba(16,185,129,0.35)'), at(100, 'box-shadow:0 0 0 26px rgba(16,185,129,0)')) },
  { name: 'tilt', label: 'Tilt', category: 'Attention', duration: '0.6s', keyframes: kf(at(0, 'transform:perspective(500px) rotateX(0deg)'), at(50, 'transform:perspective(500px) rotateX(22deg) translateZ(10px)'), at(100, 'transform:perspective(500px) rotateX(0deg)')) },
  { name: 'tripod', label: 'Tripod', category: 'Attention', duration: '0.8s', keyframes: kf('transform-origin: 50% 100%;transform:rotate(0deg)', at(50, 'transform:rotate(-8deg)'), to('transform:rotate(0deg)')) },
  { name: 'jello', label: 'Jello', category: 'Attention', duration: '0.9s', keyframes: kf('transform:scale3d(1,1,1)', at(30, 'transform:scale3d(1.25,0.75,1)'), at(40, 'transform:scale3d(0.75,1.25,1)'), at(50, 'transform:scale3d(1.25,0.75,1)'), at(60, 'transform:scale3d(0.75,1.25,1)'), at(70, 'transform:scale3d(1.25,0.75,1)'), at(100, 'transform:scale3d(1,1,1)')) },
  { name: 'rubberBand', label: 'Rubber Band', category: 'Attention', duration: '1s', keyframes: kf('transform:scale3d(1,1,1)', at(30, 'transform:scale3d(1.25,0.75,1)'), at(45, 'transform:scale3d(0.85,1.2,1)'), at(60, 'transform:scale3d(1.1,0.9,1)'), at(80, 'transform:scale3d(0.98,1.02,1)'), to('transform:scale3d(1,1,1)')) },
  { name: 'rubberBandSoft', label: 'Rubber Band Soft', category: 'Attention', duration: '1.1s', keyframes: kf('transform:scale3d(1,1,1)', at(35, 'transform:scale3d(1.1,0.92,1)'), at(60, 'transform:scale3d(0.96,1.04,1)'), to('transform:scale3d(1,1,1)')) },
  { name: 'rubberSnap', label: 'Rubber Snap', category: 'Attention', duration: '0.5s', easing: 'cubic-bezier(0.5, -0.6, 0.4, 1.6)', keyframes: kf(from('transform:scaleX(1.3) scaleY(0.8)'), to('transform:scaleX(1) scaleY(1)')) },
  { name: 'rubberStretch', label: 'Rubber Stretch', category: 'Attention', duration: '0.8s', keyframes: kf(at(0, 'transform:scale(1,1)'), at(30, 'transform:scale(1.3,0.7)'), at(60, 'transform:scale(0.8,1.2)'), at(100, 'transform:scale(1,1)')) },
];

/* ------------------------------------------------------------------ *
 * Elastic — 12                                                        *
 * ------------------------------------------------------------------ */

const ELASTIC: Draft[] = [
  { name: 'elasticIn', label: 'Elastic In', category: 'Elastic', duration: '0.9s', easing: 'cubic-bezier(0.5, -0.6, 0.4, 1.4)', keyframes: kf(from('opacity:0;transform:scale3d(0,0,0)'), at(60, 'transform:scale3d(1.1,1.1,1.1)'), to('opacity:1;transform:scale3d(1,1,1)')) },
  { name: 'elasticOut', label: 'Elastic Out', category: 'Elastic', duration: '0.8s', easing: 'cubic-bezier(0.5, -0.6, 0.4, 1.4)', keyframes: kf(from('opacity:1;transform:scale3d(1,1,1)'), to('opacity:0;transform:scale3d(0,0,0)')) },
  { name: 'elasticInUp', label: 'Elastic In Up', category: 'Elastic', duration: '0.9s', keyframes: kf(from('opacity:0;transform:translateY(70%) scale(0.4)'), at(60, 'transform:translateY(-8%) scale(1.06)'), to('opacity:1;transform:translateY(0) scale(1)')) },
  { name: 'elasticInDown', label: 'Elastic In Down', category: 'Elastic', duration: '0.9s', keyframes: kf(from('opacity:0;transform:translateY(-70%) scale(0.4)'), at(60, 'transform:translateY(8%) scale(1.06)'), to('opacity:1;transform:translateY(0) scale(1)')) },
  { name: 'elasticInLeft', label: 'Elastic In Left', category: 'Elastic', duration: '0.9s', keyframes: kf(from('opacity:0;transform:translateX(-70%) scale(0.4)'), at(60, 'transform:translateX(8%) scale(1.06)'), to('opacity:1;transform:translateX(0) scale(1)')) },
  { name: 'elasticInRight', label: 'Elastic In Right', category: 'Elastic', duration: '0.9s', keyframes: kf(from('opacity:0;transform:translateX(70%) scale(0.4)'), at(60, 'transform:translateX(-8%) scale(1.06)'), to('opacity:1;transform:translateX(0) scale(1)')) },
  { name: 'elasticOutUp', label: 'Elastic Out Up', category: 'Elastic', duration: '0.8s', keyframes: kf(from('opacity:1;transform:translateY(0) scale(1)'), to('opacity:0;transform:translateY(-70%) scale(0.4)')) },
  { name: 'elasticOutDown', label: 'Elastic Out Down', category: 'Elastic', duration: '0.8s', keyframes: kf(from('opacity:1;transform:translateY(0) scale(1)'), to('opacity:0;transform:translateY(70%) scale(0.4)')) },
  { name: 'elasticOutLeft', label: 'Elastic Out Left', category: 'Elastic', duration: '0.8s', keyframes: kf(from('opacity:1;transform:translateX(0) scale(1)'), to('opacity:0;transform:translateX(-70%) scale(0.4)')) },
  { name: 'elasticOutRight', label: 'Elastic Out Right', category: 'Elastic', duration: '0.8s', keyframes: kf(from('opacity:1;transform:translateX(0) scale(1)'), to('opacity:0;transform:translateX(70%) scale(0.4)')) },
  { name: 'elasticHard', label: 'Elastic Hard', category: 'Elastic', duration: '1.2s', easing: 'cubic-bezier(0.6, -0.3, 0.3, 1.6)', keyframes: kf('transform:scale(1)', at(25, 'transform:scale(1.35)'), at(50, 'transform:scale(0.85)'), at(75, 'transform:scale(1.12)'), to('transform:scale(1)')) },
  { name: 'elasticSettle', label: 'Elastic Settle', category: 'Elastic', duration: '1.1s', keyframes: kf('transform:scale(1.4);opacity:0', at(45, 'transform:scale(0.9);opacity:1'), at(70, 'transform:scale(1.05)'), to('transform:scale(1);opacity:1')) },
];

/* ------------------------------------------------------------------ *
 * Swings — 16                                                         *
 * ------------------------------------------------------------------ */

const SWINGS: Draft[] = [
  { name: 'swing', label: 'Swing', category: 'Swings', duration: '1s', easing: 'ease-in-out', keyframes: kf('transform-origin:top center', at(20, 'transform:rotate(7deg)'), at(40, 'transform:rotate(-10deg)'), at(60, 'transform:rotate(6deg)'), at(80, 'transform:rotate(-4deg)'), at(100, 'transform:rotate(0deg)')) },
  { name: 'swingHard', label: 'Swing Hard', category: 'Swings', duration: '0.9s', easing: 'ease-in-out', keyframes: kf('transform-origin:top center', at(25, 'transform:rotate(16deg)'), at(50, 'transform:rotate(-22deg)'), at(75, 'transform:rotate(12deg)'), to('transform:rotate(0deg)')) },
  { name: 'swingSoft', label: 'Swing Soft', category: 'Swings', duration: '1.4s', easing: 'ease-in-out', keyframes: kf('transform-origin:top center', at(30, 'transform:rotate(4deg)'), at(60, 'transform:rotate(-5deg)'), to('transform:rotate(0deg)')) },
  { name: 'pendulum', label: 'Pendulum', category: 'Swings', duration: '1.2s', iteration: 'infinite', easing: 'ease-in-out', keyframes: kf('transform-origin:top center', at(25, 'transform:rotate(12deg)'), at(75, 'transform:rotate(-12deg)'), to('transform:rotate(0deg)')) },
  { name: 'pendulumLeft', label: 'Pendulum Left', category: 'Swings', duration: '1.2s', iteration: 'infinite', easing: 'ease-in-out', keyframes: kf('transform-origin:top center', at(30, 'transform:rotate(-12deg)'), at(70, 'transform:rotate(0deg)'), to('transform:rotate(0deg)')) },
  { name: 'pendulumRight', label: 'Pendulum Right', category: 'Swings', duration: '1.2s', iteration: 'infinite', easing: 'ease-in-out', keyframes: kf('transform-origin:top center', at(30, 'transform:rotate(12deg)'), at(70, 'transform:rotate(0deg)'), to('transform:rotate(0deg)')) },
  { name: 'pendulumWide', label: 'Pendulum Wide', category: 'Swings', duration: '1.6s', iteration: 'infinite', easing: 'ease-in-out', keyframes: kf('transform-origin:top center', at(25, 'transform:rotate(26deg)'), at(75, 'transform:rotate(-26deg)'), to('transform:rotate(0deg)')) },
  { name: 'sway', label: 'Sway', category: 'Swings', duration: '1.4s', easing: 'ease-in-out', iteration: 'infinite', keyframes: kf('transform:translateX(0) rotate(0deg)', at(30, 'transform:translateX(8px) rotate(2deg)'), at(60, 'transform:translateX(-8px) rotate(-2deg)'), to('transform:translateX(0) rotate(0deg)')) },
  { name: 'swayLeft', label: 'Sway Left', category: 'Swings', duration: '1.4s', easing: 'ease-in-out', iteration: 'infinite', keyframes: kf('transform:translateX(0)', at(35, 'transform:translateX(-14px)'), at(70, 'transform:translateX(0)'), to('transform:translateX(0)')) },
  { name: 'swayRight', label: 'Sway Right', category: 'Swings', duration: '1.4s', easing: 'ease-in-out', iteration: 'infinite', keyframes: kf('transform:translateX(0)', at(35, 'transform:translateX(14px)'), at(70, 'transform:translateX(0)'), to('transform:translateX(0)')) },
  { name: 'swaySoft', label: 'Sway Soft', category: 'Swings', duration: '2s', easing: 'ease-in-out', iteration: 'infinite', keyframes: kf('transform:rotate(-1.5deg)', at(50, 'transform:rotate(1.5deg)'), to('transform:rotate(-1.5deg)')) },
  { name: 'swingUp', label: 'Swing Up', category: 'Swings', duration: '0.8s', keyframes: kf('transform-origin:bottom center', from('transform:rotate(10deg)'), to('transform:rotate(-6deg)')) },
  { name: 'swingDown', label: 'Swing Down', category: 'Swings', duration: '0.8s', keyframes: kf('transform-origin:bottom center', from('transform:rotate(-10deg)'), to('transform:rotate(6deg)')) },
  { name: 'swingTilt', label: 'Swing Tilt', category: 'Swings', duration: '0.9s', easing: 'ease-in-out', keyframes: kf('transform:rotate(-4deg) skewX(4deg)', at(50, 'transform:rotate(6deg) skewX(-6deg)'), to('transform:rotate(0deg) skewX(0deg)')) },
  { name: 'swingKick', label: 'Swing Kick', category: 'Swings', duration: '0.7s', easing: 'ease-out', keyframes: kf('transform-origin:left bottom', at(40, 'transform:rotate(-14deg) translateY(-8px)'), to('transform:rotate(0deg) translateY(0)')) },
  { name: 'wobbleSway', label: 'Wobble Sway', category: 'Swings', duration: '1.3s', iteration: 'infinite', easing: 'ease-in-out', keyframes: kf('transform:translateX(-6px) rotate(-1deg)', at(50, 'transform:translateX(6px) rotate(1deg)'), to('transform:translateX(-6px) rotate(-1deg)')) },
];

/* ------------------------------------------------------------------ *
 * Pops — 14                                                           *
 * ------------------------------------------------------------------ */

const POPS: Draft[] = [
  { name: 'pop', label: 'Pop', category: 'Pops', duration: '0.4s', easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.4)', keyframes: kf(from('opacity:0;transform:scale(0.5)'), to('opacity:1;transform:scale(1)')) },
  { name: 'popUp', label: 'Pop Up', category: 'Pops', duration: '0.45s', easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.4)', keyframes: kf(from('opacity:0;transform:translateY(30px) scale(0.6)'), to('opacity:1;transform:translateY(0) scale(1)')) },
  { name: 'popDown', label: 'Pop Down', category: 'Pops', duration: '0.45s', easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.4)', keyframes: kf(from('opacity:0;transform:translateY(-30px) scale(0.6)'), to('opacity:1;transform:translateY(0) scale(1)')) },
  { name: 'popLeft', label: 'Pop Left', category: 'Pops', duration: '0.45s', easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.4)', keyframes: kf(from('opacity:0;transform:translateX(-30px) scale(0.6)'), to('opacity:1;transform:translateX(0) scale(1)')) },
  { name: 'popRight', label: 'Pop Right', category: 'Pops', duration: '0.45s', easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.4)', keyframes: kf(from('opacity:0;transform:translateX(30px) scale(0.6)'), to('opacity:1;transform:translateX(0) scale(1)')) },
  { name: 'popGrow', label: 'Pop Grow', category: 'Pops', duration: '0.6s', keyframes: kf(from('transform:scale(0.4)'), at(60, 'transform:scale(1.2)'), to('transform:scale(1)')) },
  { name: 'popShrink', label: 'Pop Shrink', category: 'Pops', duration: '0.6s', keyframes: kf(from('transform:scale(1.6);opacity:1'), at(60, 'transform:scale(0.85)'), to('transform:scale(1);opacity:1')) },
  { name: 'popSwell', label: 'Pop Swell', category: 'Pops', duration: '0.7s', easing: 'ease-out', keyframes: kf(from('transform:scale(0.9)'), at(50, 'transform:scale(1.12)'), to('transform:scale(1)')) },
  { name: 'popBoom', label: 'Pop Boom', category: 'Pops', duration: '0.5s', keyframes: kf(from('opacity:0;transform:scale(0.1)'), at(70, 'opacity:1;transform:scale(1.3)'), to('opacity:1;transform:scale(1)')) },
  { name: 'popSoft', label: 'Pop Soft', category: 'Pops', duration: '0.8s', easing: 'cubic-bezier(0.34, 1.3, 0.64, 1)', keyframes: kf(from('opacity:0;transform:scale(0.85)'), to('opacity:1;transform:scale(1)')) },
  { name: 'popQuick', label: 'Pop Quick', category: 'Pops', duration: '0.25s', easing: 'ease-out', keyframes: kf(from('transform:scale(0.7)'), to('transform:scale(1)')) },
  { name: 'popLate', label: 'Pop Late', category: 'Pops', duration: '0.6s', delay: '0.2s', easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.4)', keyframes: kf(from('opacity:0;transform:scale(0.4)'), to('opacity:1;transform:scale(1)')) },
  { name: 'popStretch', label: 'Pop Stretch', category: 'Pops', duration: '0.6s', keyframes: kf(at(0, 'transform:scale(0.6,1.3)'), at(50, 'transform:scale(1.2,0.85)'), to('transform:scale(1,1)')) },
  { name: 'popSnap', label: 'Pop Snap', category: 'Pops', duration: '0.4s', easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)', keyframes: kf(at(0, 'transform:scale(0.6) translateY(0)'), at(60, 'transform:scale(1.08) translateY(-4px)'), to('transform:scale(1) translateY(0)')) },
];

/* ------------------------------------------------------------------ *
 * 3D — 18                                                            *
 * ------------------------------------------------------------------ */

const THREE_D: Draft[] = [
  { name: 'cubeIn', label: 'Cube In', category: '3D', duration: '0.8s', keyframes: kf(from('opacity:0;transform:perspective(500px) rotateY(90deg) translateZ(-80px);transform-origin:50% 50%'), to('opacity:1;transform:perspective(500px) rotateY(0deg) translateZ(0);transform-origin:50% 50%')) },
  { name: 'cubeOut', label: 'Cube Out', category: '3D', duration: '0.7s', keyframes: kf(from('opacity:1;transform:perspective(500px) rotateY(0deg) translateZ(0);transform-origin:50% 50%'), to('opacity:0;transform:perspective(500px) rotateY(-90deg) translateZ(-80px);transform-origin:50% 50%')) },
  { name: 'cubeInTop', label: 'Cube In Top', category: '3D', duration: '0.8s', keyframes: kf(from('opacity:0;transform:perspective(500px) rotateX(90deg);transform-origin:50% 0'), to('opacity:1;transform:perspective(500px) rotateX(0deg);transform-origin:50% 0')) },
  { name: 'cubeInDown', label: 'Cube In Down', category: '3D', duration: '0.8s', keyframes: kf(from('opacity:0;transform:perspective(500px) rotateX(-90deg);transform-origin:50% 100%'), to('opacity:1;transform:perspective(500px) rotateX(0deg);transform-origin:50% 100%')) },
  { name: 'cubeOutTop', label: 'Cube Out Top', category: '3D', duration: '0.7s', keyframes: kf(from('opacity:1;transform:perspective(500px) rotateX(0deg);transform-origin:50% 0'), to('opacity:0;transform:perspective(500px) rotateX(-90deg);transform-origin:50% 0')) },
  { name: 'cubeOutDown', label: 'Cube Out Down', category: '3D', duration: '0.7s', keyframes: kf(from('opacity:1;transform:perspective(500px) rotateX(0deg);transform-origin:50% 100%'), to('opacity:0;transform:perspective(500px) rotateX(90deg);transform-origin:50% 100%')) },
  { name: 'cubeInLeft', label: 'Cube In Left', category: '3D', duration: '0.8s', keyframes: kf(from('opacity:0;transform:perspective(500px) rotateY(-90deg);transform-origin:0 50%'), to('opacity:1;transform:perspective(500px) rotateY(0deg);transform-origin:0 50%')) },
  { name: 'cubeInRight', label: 'Cube In Right', category: '3D', duration: '0.8s', keyframes: kf(from('opacity:0;transform:perspective(500px) rotateY(90deg);transform-origin:100% 50%'), to('opacity:1;transform:perspective(500px) rotateY(0deg);transform-origin:100% 50%')) },
  { name: 'cubeOutLeft', label: 'Cube Out Left', category: '3D', duration: '0.7s', keyframes: kf(from('opacity:1;transform:perspective(500px) rotateY(0deg);transform-origin:0 50%'), to('opacity:0;transform:perspective(500px) rotateY(90deg);transform-origin:0 50%')) },
  { name: 'cubeOutRight', label: 'Cube Out Right', category: '3D', duration: '0.7s', keyframes: kf(from('opacity:1;transform:perspective(500px) rotateY(0deg);transform-origin:100% 50%'), to('opacity:0;transform:perspective(500px) rotateY(-90deg);transform-origin:100% 50%')) },
  { name: 'hingeLeft', label: 'Hinge Left', category: '3D', duration: '0.8s', keyframes: kf(from('transform-origin:0 50%;transform:perspective(500px) rotateY(80deg);opacity:0'), to('transform-origin:0 50%;transform:perspective(500px) rotateY(0deg);opacity:1')) },
  { name: 'hingeRight', label: 'Hinge Right', category: '3D', duration: '0.8s', keyframes: kf(from('transform-origin:100% 50%;transform:perspective(500px) rotateY(-80deg);opacity:0'), to('transform-origin:100% 50%;transform:perspective(500px) rotateY(0deg);opacity:1')) },
  { name: 'hingeUp', label: 'Hinge Up', category: '3D', duration: '0.8s', keyframes: kf(from('transform-origin:50% 0;transform:perspective(500px) rotateX(-80deg);opacity:0'), to('transform-origin:50% 0;transform:perspective(500px) rotateX(0deg);opacity:1')) },
  { name: 'hingeDown', label: 'Hinge Down', category: '3D', duration: '0.8s', keyframes: kf(from('transform-origin:50% 100%;transform:perspective(500px) rotateX(80deg);opacity:0'), to('transform-origin:50% 100%;transform:perspective(500px) rotateX(0deg);opacity:1')) },
  { name: 'perspectiveIn', label: 'Perspective In', category: '3D', duration: '0.9s', keyframes: kf(from('opacity:0;transform:perspective(300px) rotateX(35deg) translateZ(-200px)'), to('opacity:1;transform:perspective(300px) rotateX(0deg) translateZ(0)')) },
  { name: 'perspectiveOut', label: 'Perspective Out', category: '3D', duration: '0.8s', keyframes: kf(from('opacity:1;transform:perspective(300px) rotateX(0deg) translateZ(0)'), to('opacity:0;transform:perspective(300px) rotateX(-35deg) translateZ(-200px)')) },
  { name: 'rotateY180', label: 'Rotate Y 180', category: '3D', duration: '0.9s', keyframes: kf(from('transform:perspective(600px) rotateY(0deg);backface-visibility:visible'), at(50, 'transform:perspective(600px) rotateY(90deg) scale(1.05);opacity:0.6'), to('transform:perspective(600px) rotateY(180deg);backface-visibility:visible')) },
  { name: 'rotateX180', label: 'Rotate X 180', category: '3D', duration: '0.9s', keyframes: kf(from('transform:perspective(600px) rotateX(0deg)'), at(50, 'transform:perspective(600px) rotateX(90deg) scale(1.05);opacity:0.6'), to('transform:perspective(600px) rotateX(180deg)')) },
];

/* ------------------------------------------------------------------ *
 * Reveals — 14                                                        *
 * ------------------------------------------------------------------ */

const REVEALS: Draft[] = [
  { name: 'revealFromLeft', label: 'Reveal From Left', category: 'Reveals', duration: '0.8s', easing: 'cubic-bezier(0.22, 1, 0.36, 1)', keyframes: kf(from('clip-path:inset(0 100% 0 0);opacity:1'), to('clip-path:inset(0 0 0 0);opacity:1')) },
  { name: 'revealFromRight', label: 'Reveal From Right', category: 'Reveals', duration: '0.8s', easing: 'cubic-bezier(0.22, 1, 0.36, 1)', keyframes: kf(from('clip-path:inset(0 0 0 100%);opacity:1'), to('clip-path:inset(0 0 0 0);opacity:1')) },
  { name: 'revealFromTop', label: 'Reveal From Top', category: 'Reveals', duration: '0.8s', easing: 'cubic-bezier(0.22, 1, 0.36, 1)', keyframes: kf(from('clip-path:inset(100% 0 0 0);opacity:1'), to('clip-path:inset(0 0 0 0);opacity:1')) },
  { name: 'revealFromBottom', label: 'Reveal From Bottom', category: 'Reveals', duration: '0.8s', easing: 'cubic-bezier(0.22, 1, 0.36, 1)', keyframes: kf(from('clip-path:inset(0 0 100% 0);opacity:1'), to('clip-path:inset(0 0 0 0);opacity:1')) },
  { name: 'wipeLeft', label: 'Wipe Left', category: 'Reveals', duration: '0.7s', keyframes: kf(from('clip-path:inset(0 100% 0 0)'), to('clip-path:inset(0 0 0 0)')) },
  { name: 'wipeRight', label: 'Wipe Right', category: 'Reveals', duration: '0.7s', keyframes: kf(from('clip-path:inset(0 0 0 100%)'), to('clip-path:inset(0 0 0 0)')) },
  { name: 'wipeTop', label: 'Wipe Top', category: 'Reveals', duration: '0.7s', keyframes: kf(from('clip-path:inset(100% 0 0 0)'), to('clip-path:inset(0 0 0 0)')) },
  { name: 'wipeBottom', label: 'Wipe Bottom', category: 'Reveals', duration: '0.7s', keyframes: kf(from('clip-path:inset(0 0 100% 0)'), to('clip-path:inset(0 0 0 0)')) },
  { name: 'curtain', label: 'Curtain', category: 'Reveals', duration: '1s', easing: 'cubic-bezier(0.6, 0, 0.2, 1)', keyframes: kf(from('clip-path:inset(0 50% 0 50%)'), to('clip-path:inset(0 0 0 0)')) },
  { name: 'sweepLeft', label: 'Sweep Left', category: 'Reveals', duration: '0.9s', easing: 'cubic-bezier(0.17, 0.67, 0.31, 1.2)', keyframes: kf(from('transform:skewX(-18deg) translateX(-130%);opacity:1'), to('transform:skewX(0deg) translateX(0);opacity:1')) },
  { name: 'sweepRight', label: 'Sweep Right', category: 'Reveals', duration: '0.9s', easing: 'cubic-bezier(0.17, 0.67, 0.31, 1.2)', keyframes: kf(from('transform:skewX(18deg) translateX(130%);opacity:1'), to('transform:skewX(0deg) translateX(0);opacity:1')) },
  { name: 'irisIn', label: 'Iris In', category: 'Reveals', duration: '0.9s', keyframes: kf(from('clip-path:circle(0% at 50% 50%);opacity:1'), to('clip-path:circle(75% at 50% 50%);opacity:1')) },
  { name: 'expandBar', label: 'Expand Bar', category: 'Reveals', duration: '0.8s', easing: 'cubic-bezier(0.22, 1, 0.36, 1)', keyframes: kf(from('clip-path:inset(0 50% 0 50%)'), at(60, 'clip-path:inset(0 45% 0 45%)'), to('clip-path:inset(0 0 0 0)')) },
  { name: 'blindsOpen', label: 'Blinds Open', category: 'Reveals', duration: '0.9s', easing: 'steps(8, end)', keyframes: kf(from('clip-path:inset(0 0 0 100%)'), to('clip-path:inset(0 0 0 0)')) },
];

/* ------------------------------------------------------------------ *
 * Lights — 12                                                         *
 * ------------------------------------------------------------------ */

const LIGHTS: Draft[] = [
  { name: 'glow', label: 'Glow', category: 'Lights', duration: '1.6s', iteration: 'infinite', easing: 'ease-in-out', keyframes: kf(at(0, 'filter:drop-shadow(0 0 0 rgba(99,102,241,0))'), at(50, 'filter:drop-shadow(0 0 14px rgba(99,102,241,0.9))'), at(100, 'filter:drop-shadow(0 0 0 rgba(99,102,241,0))')) },
  { name: 'glowPulse', label: 'Glow Pulse', category: 'Lights', duration: '1.4s', iteration: 'infinite', keyframes: kf(at(0, 'text-shadow:0 0 4px rgba(34,197,94,0.4)'), at(50, 'text-shadow:0 0 18px rgba(34,197,94,1), 0 0 34px rgba(34,197,94,0.6)'), at(100, 'text-shadow:0 0 4px rgba(34,197,94,0.4)')) },
  { name: 'glowGrow', label: 'Glow Grow', category: 'Lights', duration: '1.2s', iteration: 'infinite', keyframes: kf(at(0, 'box-shadow:0 0 0 0 rgba(236,72,153,0.55)'), at(70, 'box-shadow:0 0 22px 6px rgba(236,72,153,0.15)'), at(100, 'box-shadow:0 0 0 0 rgba(236,72,153,0.55)')) },
  { name: 'glowSoft', label: 'Glow Soft', category: 'Lights', duration: '2.2s', iteration: 'infinite', easing: 'ease-in-out', keyframes: kf(at(0, 'filter:brightness(1) saturate(1)'), at(50, 'filter:brightness(1.25) saturate(1.3)'), at(100, 'filter:brightness(1) saturate(1)')) },
  { name: 'neon', label: 'Neon', category: 'Lights', duration: '2s', iteration: 'infinite', easing: 'ease-in-out', keyframes: kf(at(0, 'text-shadow:0 0 6px #22d3ee, 0 0 12px #22d3ee, 0 0 22px #0891b2'), at(50, 'text-shadow:0 0 14px #67e8f9, 0 0 26px #22d3ee, 0 0 44px #0891b2'), at(100, 'text-shadow:0 0 6px #22d3ee, 0 0 12px #22d3ee, 0 0 22px #0891b2')) },
  { name: 'flicker', label: 'Flicker', category: 'Lights', duration: '1.2s', iteration: 'infinite', keyframes: kf('opacity:1', at(8, 'opacity:0.4'), at(12, 'opacity:1'), at(22, 'opacity:0.7'), at(26, 'opacity:1'), at(60, 'opacity:0.5'), at(64, 'opacity:1'), at(100, 'opacity:1')) },
  { name: 'shimmer', label: 'Shimmer', category: 'Lights', duration: '1.8s', iteration: 'infinite', keyframes: kf('background-position:-200% 0', at(50, 'background-position:200% 0'), to('background-position:-200% 0')) },
  { name: 'lightSweep', label: 'Light Sweep', category: 'Lights', duration: '1.1s', easing: 'ease-in-out', keyframes: kf(from('opacity:0;transform:translateX(-120%) skewX(-20deg)'), at(50, 'opacity:1'), to('opacity:0;transform:translateX(120%) skewX(-20deg)')) },
  { name: 'spotlight', label: 'Spotlight', category: 'Lights', duration: '1.6s', iteration: 'infinite', easing: 'ease-in-out', keyframes: kf('clip-path:circle(18% at 50% 50%)', at(50, 'clip-path:circle(75% at 50% 50%)'), to('clip-path:circle(18% at 50% 50%)')) },
  { name: 'halo', label: 'Halo', category: 'Lights', duration: '2.4s', iteration: 'infinite', easing: 'ease-in-out', keyframes: kf(at(0, 'box-shadow:inset 0 0 0 2px rgba(255,255,255,0.1), 0 0 0 0 rgba(255,255,255,0.25)'), at(70, 'box-shadow:inset 0 0 0 2px rgba(255,255,255,0.35), 0 0 26px 6px rgba(255,255,255,0.08)'), at(100, 'box-shadow:inset 0 0 0 2px rgba(255,255,255,0.1), 0 0 0 0 rgba(255,255,255,0.25)')) },
  { name: 'twinkle', label: 'Twinkle', category: 'Lights', duration: '1.5s', iteration: 'infinite', easing: 'ease-in-out', keyframes: kf(at(0, 'opacity:0.3;transform:scale(0.85)'), at(50, 'opacity:1;transform:scale(1.1)'), to('opacity:0.3;transform:scale(0.85)')) },
  { name: 'blinkLight', label: 'Blink Light', category: 'Lights', duration: '1s', iteration: 'infinite', keyframes: kf('opacity:1', at(49, 'opacity:1'), at(50, 'opacity:0'), at(100, 'opacity:0')) },
];

/* ------------------------------------------------------------------ *
 * Loops — 12                                                          *
 * ------------------------------------------------------------------ */

const LOOPS: Draft[] = [
  { name: 'floatUp', label: 'Float Up', category: 'Loops', duration: '3s', iteration: 'infinite', easing: 'ease-in-out', keyframes: kf(at(0, 'transform:translateY(0)'), at(50, 'transform:translateY(-14px)'), to('transform:translateY(0)')) },
  { name: 'floatDown', label: 'Float Down', category: 'Loops', duration: '3s', iteration: 'infinite', easing: 'ease-in-out', keyframes: kf(at(0, 'transform:translateY(0)'), at(50, 'transform:translateY(14px)'), to('transform:translateY(0)')) },
  { name: 'driftLeft', label: 'Drift Left', category: 'Loops', duration: '4s', iteration: 'infinite', easing: 'ease-in-out', keyframes: kf(at(0, 'transform:translateX(0) rotate(0deg)'), at(50, 'transform:translateX(-18px) rotate(-1.5deg)'), to('transform:translateX(0) rotate(0deg)')) },
  { name: 'driftRight', label: 'Drift Right', category: 'Loops', duration: '4s', iteration: 'infinite', easing: 'ease-in-out', keyframes: kf(at(0, 'transform:translateX(0) rotate(0deg)'), at(50, 'transform:translateX(18px) rotate(1.5deg)'), to('transform:translateX(0) rotate(0deg)')) },
  { name: 'levitate', label: 'Levitate', category: 'Loops', duration: '3.4s', iteration: 'infinite', easing: 'ease-in-out', keyframes: kf(at(0, 'transform:translateY(0) scale(1)'), at(50, 'transform:translateY(-20px) scale(1.03)'), to('transform:translateY(0) scale(1)')) },
  { name: 'breathe', label: 'Breathe', category: 'Loops', duration: '4.2s', iteration: 'infinite', easing: 'ease-in-out', keyframes: kf(at(0, 'transform:scale(1);opacity:0.9'), at(50, 'transform:scale(1.05);opacity:1'), to('transform:scale(1);opacity:0.9')) },
  { name: 'orbitLoop', label: 'Orbit Loop', category: 'Loops', duration: '6s', iteration: 'infinite', easing: 'linear', keyframes: kf('transform:rotate(0deg) translateX(24px) rotate(0deg)', to('transform:rotate(360deg) translateX(24px) rotate(-360deg)')) },
  { name: 'gradientShift', label: 'Gradient Shift', category: 'Loops', duration: '6s', iteration: 'infinite', easing: 'linear', keyframes: kf('background-position:0% 50%', to('background-position:100% 50%')) },
  { name: 'marqueeSlide', label: 'Marquee Slide', category: 'Loops', duration: '9s', iteration: 'infinite', easing: 'linear', keyframes: kf('transform:translateX(0)', to('transform:translateX(-50%)')) },
  { name: 'bgPan', label: 'Background Pan', category: 'Loops', duration: '14s', iteration: 'infinite', easing: 'linear', keyframes: kf('background-position:0% 0', to('background-position:100% 100%')) },
  { name: 'hoverFloat', label: 'Hover Float', category: 'Loops', duration: '2.6s', iteration: 'infinite', easing: 'ease-in-out', keyframes: kf(at(0, 'transform:translateY(0) rotate(-1deg)'), at(50, 'transform:translateY(-8px) rotate(1deg)'), to('transform:translateY(0) rotate(-1deg)')) },
  { name: 'twinkleLoop', label: 'Twinkle Loop', category: 'Loops', duration: '2.4s', iteration: 'infinite', easing: 'ease-in-out', keyframes: kf(at(0, 'opacity:0.5;filter:brightness(1)'), at(50, 'opacity:1;filter:brightness(1.5)'), to('opacity:0.5;filter:brightness(1)')) },
];

const LIST: Draft[] = [
  ...FADES,
  ...FLIPS,
  ...ROLLS,
  ...SLIDES,
  ...ZOOMS,
  ...ROTATIONS,
  ...BOUNCES,
  ...ATTENTION,
  ...ELASTIC,
  ...SWINGS,
  ...POPS,
  ...THREE_D,
  ...REVEALS,
  ...LIGHTS,
  ...LOOPS,
  // Hover categories are declared in this file, but the declarations are missing.
  // Keep them commented until the hover category arrays exist so the rest of the
  // library still builds.
  // ...HOVER_FLOAT,
  // ...HOVER_BREATHE,
  // ...HOVER_GLOW,
  // ...HOVER_SHIMMER,
  // ...HOVER_WOBBLE,
  // ...HOVER_ORBIT,
  // ...HOVER_TRANSFORM,
  // ...HOVER_SPEED,
  // ...HOVER_RUBBER,
  // ...HOVER_WAVE,
  // ...HOVER_TWIRL,
  // ...HOVER_MAGIC,
  // ...HOVER_STEAM,
  // ...HOVER_FROST,
  // ...HOVER_HEAT,
  // ...HOVER_RIPPLE,
];

const BUILT: AnimationPreset[] = LIST.map(preset);

/** Every preset, in library order. */
export const ANIMATION_PRESETS: readonly AnimationPreset[] = BUILT;

/** Category names in display order (first appearance wins). */
export const ANIMATION_CATEGORIES: readonly AnimationCategory[] = Array.from(
  new Set(BUILT.map((item) => item.category))
);

const BY_NAME = new Map<string, AnimationPreset>(BUILT.map((item) => [item.name, item]));

/** Look up one preset by its animation-name. */
export function presetByName(name: string | undefined | null): AnimationPreset | undefined {
  if (!name) return undefined;
  return BY_NAME.get(String(name).trim());
}

/** Category + free-text filter used by the presets panel. */
export function filterPresets(query: string, category: string): AnimationPreset[] {
  const needle = query.trim().toLowerCase();
  return BUILT.filter((item) => {
    if (category !== 'All' && item.category !== category) return false;
    if (!needle) return true;
    return (
      item.label.toLowerCase().includes(needle) ||
      item.name.toLowerCase().includes(needle) ||
      item.category.toLowerCase().includes(needle)
    );
  });
}

/** The @keyframes rule for one preset. */
export function presetKeyframesCSS(item: AnimationPreset): string {
  return `@keyframes ${item.name} { ${item.keyframes} }`;
}

/** Every keyframes rule, for the editor so tiles can play themselves. */
export function allPresetKeyframesCSS(): string {
  return BUILT.map(presetKeyframesCSS).join('\n');
}

/** The style patch that applies a preset to an element. */
export function presetStylePatch(item: AnimationPreset): Partial<StyleProps> {
  return {
    animationName: item.name,
    animationDuration: item.duration,
    animationTimingFunction: item.easing,
    animationIterationCount: item.iteration,
    animationDelay: item.delay,
    animationDirection: item.direction,
    animationFillMode: item.fillMode,
  };
}

/** Clears every animation field so the element goes back to a still frame. */
export function clearAnimationPatch(): Partial<StyleProps> {
  return {
    animation: undefined,
    animationName: undefined,
    animationDuration: undefined,
    animationDelay: undefined,
    animationIterationCount: undefined,
    animationDirection: undefined,
    animationFillMode: undefined,
    animationTimingFunction: undefined,
    animationPlayState: undefined,
  };
}

/** Animation names used anywhere in a design (desktop + both breakpoints). */
export function usedAnimationNames(elements: Record<string, ElementNode> | undefined): string[] {
  const names = new Set<string>();
  const visit = (node?: ElementNode) => {
    if (!node) return;
    const bags = [node.styles, node.responsive?.tablet, node.responsive?.mobile];
    for (const bag of bags) {
      const raw = bag && (bag as StyleProps).animationName;
      const found = presetByName(raw);
      if (found) names.add(found.name);
    }
    (node.children || []).forEach((childId) => visit(elements?.[childId]));
  };
  Object.values(elements || {}).forEach(visit);
  return Array.from(names);
}

/**
 * Keyframes CSS for exactly the presets a design uses. Generated sites only
 * ship what they animate.
 */
export function usedPresetKeyframesCSS(elements: Record<string, ElementNode> | undefined): string {
  return usedAnimationNames(elements)
    .map((name) => presetByName(name))
    .filter((item): item is AnimationPreset => !!item)
    .map(presetKeyframesCSS)
    .join('\n');
}

export function isHoverPreset(_item: AnimationPreset): boolean {
  return false;
}
export function isHoverCategory(_category: AnimationCategory): boolean {
  return false;
}
