import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import HorariosPorFranja from './HorariosPorFranja';

const horarios = Array.from({ length: 72 }, (_, i) => new Date(Date.parse('2030-11-03T00:00:00-03:00') + i * 20 * 60000).toISOString());

it('limita los 72 horarios, agrupa en hora argentina y continúa solo con selección explícita', () => {
  const continuar = vi.fn();
  render(<HorariosPorFranja horarios={horarios} onContinuar={continuar} />);
  expect(screen.getAllByRole('button', { name: /^\d\d:\d\d$/ })).toHaveLength(18);
  expect(screen.getByRole('button', { name: /Madrugada/ })).toHaveTextContent('18 disponibles');
  expect(screen.queryByRole('button', { name: '06:00' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Mañana/ }));
  expect(screen.queryByRole('button', { name: '00:00' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '09:20' }));
  expect(continuar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  expect(continuar).toHaveBeenCalledWith('2030-11-03T12:20:00.000Z');
});

it('ofrece más horarios progresivamente incluso con intervalos de un minuto', () => {
  const muchos = Array.from({ length: 360 }, (_, i) => new Date(Date.parse(horarios[0]) + i * 60000).toISOString());
  render(<HorariosPorFranja horarios={muchos} onContinuar={vi.fn()} />);
  expect(screen.getAllByRole('button', { name: /^\d\d:\d\d$/ })).toHaveLength(18);
  fireEvent.click(screen.getByRole('button', { name: /Ver más horarios/ }));
  expect(screen.getAllByRole('button', { name: /^\d\d:\d\d$/ })).toHaveLength(36);
  fireEvent.click(screen.getByRole('button', { name: 'Ver menos' }));
  expect(screen.getAllByRole('button', { name: /^\d\d:\d\d$/ })).toHaveLength(18);
});
