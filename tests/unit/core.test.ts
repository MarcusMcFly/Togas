import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/services/EventBus';
import { MemoryStore, SaveManager } from '../../src/core/services/SaveManager';
import { SettingsManager } from '../../src/core/services/SettingsManager';
import { Random } from '../../src/core/utils/Random';

describe('EventBus', () => {
  it('entrega eventos y permite darse de baja', () => {
    const bus = new EventBus<{ ping: number }>();
    const handler = vi.fn();
    const off = bus.on('ping', handler);
    bus.emit('ping', 1);
    off();
    bus.emit('ping', 2);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(1);
    expect(bus.listenerCount()).toBe(0);
  });
});

describe('SaveManager', () => {
  it('aísla los datos de cada juego por prefijo', () => {
    const save = new SaveManager('test', new MemoryStore());
    save.scope('a').set('best', 10);
    expect(save.scope('a').get('best', 0)).toBe(10);
    expect(save.scope('b').get('best', 0)).toBe(0);
  });

  it('devuelve el valor por defecto si el dato está corrupto', () => {
    const store = new MemoryStore();
    store.setItem('test:a:best', '{no es json');
    expect(new SaveManager('test', store).scope('a').get('best', 7)).toBe(7);
  });
});

describe('SettingsManager', () => {
  it('persiste los ajustes entre "recargas" (AC-11)', () => {
    const store = new MemoryStore();
    new SettingsManager(new SaveManager('t', store).scope('settings')).update({ muted: true, volume: 0.3 });
    const reloaded = new SettingsManager(new SaveManager('t', store).scope('settings'));
    expect(reloaded.current).toMatchObject({ muted: true, volume: 0.3 });
  });

  it('limita el volumen a [0, 1]', () => {
    const settings = new SettingsManager(new SaveManager('t', new MemoryStore()).scope('s'));
    settings.update({ volume: 5 });
    expect(settings.current.volume).toBe(1);
  });
});

describe('Random', () => {
  it('es reproducible con la misma semilla', () => {
    const a = new Random(99);
    const b = new Random(99);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
  });
});
