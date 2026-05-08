export const EV = {
  LAUNCH:        'LAUNCH',
  BRICK_HIT:     'BRICK_HIT',
  BALL_LOST:     'BALL_LOST',
};

const _listeners = {};

export const bus = {
  on(event, fn)  { (_listeners[event] ??= []).push(fn); },
  off(event, fn) { _listeners[event] = (_listeners[event] ?? []).filter(f => f !== fn); },
  emit(event, data) { (_listeners[event] ?? []).forEach(fn => fn(data)); },
};