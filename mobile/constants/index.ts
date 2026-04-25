export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000/api/v1';
export const SOCKET_URL  = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://10.0.2.2:5000';

export const MATCH_STATES = {
  NOT_STARTED:    'NOT_STARTED',
  TOSS_DONE:      'TOSS_DONE',
  FIRST_INNINGS:  'FIRST_INNINGS',
  INNINGS_BREAK:  'INNINGS_BREAK',
  SECOND_INNINGS: 'SECOND_INNINGS',
  COMPLETED:      'COMPLETED',
  ABANDONED:      'ABANDONED',
} as const;

export const EXTRA_TYPES = {
  WIDE:    'wide',
  NO_BALL: 'no_ball',
  BYE:     'bye',
  LEG_BYE: 'leg_bye',
} as const;

export const WICKET_TYPES = [
  { value: 'bowled',           label: 'Bowled' },
  { value: 'caught',           label: 'Caught' },
  { value: 'lbw',              label: 'LBW' },
  { value: 'run_out',          label: 'Run Out' },
  { value: 'stumped',          label: 'Stumped' },
  { value: 'hit_wicket',       label: 'Hit Wicket' },
  { value: 'caught_and_bowled',label: 'C&B' },
] as const;

export const COLORS = {
  primary:  '#1E3A5F',
  accent:   '#F4A200',
  danger:   '#EF4444',
  success:  '#22C55E',
  warning:  '#F59E0B',
  white:    '#FFFFFF',
  black:    '#000000',
  gray:     {
    50:  '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
} as const;
