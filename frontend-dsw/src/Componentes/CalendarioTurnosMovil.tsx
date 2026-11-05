import { useEffect, useState } from 'react';
import { Alert, Box, Button, CardActionArea, Chip, IconButton, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { estadosTurno, type Turno, type TurnoParaDoctor } from '../Tipos/dominio';

const zona = 'America/Argentina/Buenos_Aires';
const diaArgentina = (valor: Date) => new Date(+valor - 3 * 3600000).toISOString().slice(0, 10);
const fechaUTC = (dia: string) => new Date(`${dia}T12:00:00Z`);
const sumarDias = (dia: string, cantidad: number) => new Date(+fechaUTC(dia) + cantidad * 86400000).toISOString().slice(0, 10);
const lunes = (dia: string) => sumarDias(dia, -((fechaUTC(dia).getUTCDay() + 6) % 7));
const inicioDia = (dia: string) => `${dia}T00:00:00-03:00`;
const formatoDia = new Intl.DateTimeFormat('es-AR', { timeZone: zona, weekday: 'long', day: 'numeric', month: 'long' });
const formatoMes = new Intl.DateTimeFormat('es-AR', { timeZone: zona, month: 'long', year: 'numeric' });
const formatoHora = new Intl.DateTimeFormat('es-AR', { timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const colores = { pendiente: 'info', cancelado: 'default', asistido: 'success', no_asistido: 'warning' } as const;
const finTurno = (t: Turno) => new Date(+new Date(t.fechaHoraTurno) + (t.duracionTurnoMinutos ?? 1) * 60000);
const enDia = (t: Turno, dia: string) => +new Date(t.fechaHoraTurno) < +new Date(inicioDia(sumarDias(dia, 1))) && +finTurno(t) > +new Date(inicioDia(dia));

export default function CalendarioTurnosMovil({ turnos, medico, onRango, onSeleccionar, cargando = false }: {
  turnos: Turno[]; medico: boolean; onRango: (rango: { desde: string; hasta: string }) => void;
  onSeleccionar: (turno: Turno) => void; cargando?: boolean;
}) {
  const [vista, setVista] = useState('semana');
  const [dia, setDia] = useState(() => diaArgentina(new Date()));
  const primerDiaMes = dia.slice(0, 8) + '01';
  const desdeDia = vista === 'mes' ? lunes(primerDiaMes) : vista === 'semana' ? lunes(dia) : dia;
  const hastaDia = sumarDias(desdeDia, vista === 'mes' ? 42 : vista === 'semana' ? 7 : 1);
  const desde = inicioDia(desdeDia);
  const hasta = inicioDia(hastaDia);
  useEffect(() => { onRango({ desde, hasta }); }, [desde, hasta, onRango]);

  const mover = (cantidad: number) => {
    if (vista !== 'mes') setDia(sumarDias(dia, cantidad * (vista === 'semana' ? 7 : 1)));
    else {
      const actual = fechaUTC(primerDiaMes);
      actual.setUTCMonth(actual.getUTCMonth() + cantidad);
      setDia(actual.toISOString().slice(0, 10));
    }
  };
  const ordenados = [...turnos].sort((a, b) => Date.parse(a.fechaHoraTurno) - Date.parse(b.fechaHoraTurno) || a.id - b.id);
  const dias = Array.from({ length: vista === 'semana' ? 7 : 1 }, (_, i) => vista === 'semana' ? sumarDias(desdeDia, i) : dia);
  const grupos = dias.map(fecha => ({ fecha, turnos: ordenados.filter(t => enDia(t, fecha)) })).filter(g => vista !== 'semana' || g.turnos.length);
  const titulo = vista === 'mes' ? formatoMes.format(fechaUTC(dia)) : vista === 'dia' ? formatoDia.format(fechaUTC(dia))
    : `${formatoDia.format(fechaUTC(desdeDia))} – ${formatoDia.format(fechaUTC(sumarDias(hastaDia, -1)))}`;

  return <Box aria-label="Calendario móvil de turnos" sx={{ minWidth: 0 }}>
    <ToggleButtonGroup exclusive fullWidth color="primary" value={vista} onChange={(_, v) => { if (v) setVista(v); }} aria-label="Vista del calendario" sx={{ mb: 2 }}>
      <ToggleButton value="dia">Día</ToggleButton><ToggleButton value="semana">Semana</ToggleButton><ToggleButton value="mes">Mes</ToggleButton>
    </ToggleButtonGroup>
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <IconButton aria-label="Período anterior" onClick={() => mover(-1)} sx={{ minWidth: 44, minHeight: 44 }}><ChevronLeft /></IconButton>
      <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700, textAlign: 'center', textTransform: 'capitalize' }}>{titulo}</Typography>
      <IconButton aria-label="Período siguiente" onClick={() => mover(1)} sx={{ minWidth: 44, minHeight: 44 }}><ChevronRight /></IconButton>
    </Stack>
    <Box sx={{ textAlign: 'center', my: 1 }}><Button variant="outlined" onClick={() => setDia(diaArgentina(new Date()))}>{vista === 'semana' ? 'Esta semana' : vista === 'mes' ? 'Este mes' : 'Hoy'}</Button></Box>
    {vista === 'mes' && <>
      <Box role="group" aria-label="Elegir día del mes" sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', my: 2 }}>
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <Typography key={i} aria-hidden="true" sx={{ textAlign: 'center', py: 1, fontWeight: 700 }}>{d}</Typography>)}
        {Array.from({ length: 42 }, (_, i) => {
          const fecha = sumarDias(desdeDia, i);
          const cantidad = turnos.filter(t => enDia(t, fecha)).length;
          const actual = fecha.slice(0, 7) === dia.slice(0, 7);
          return <Button key={fecha} aria-pressed={fecha === dia} aria-label={`${formatoDia.format(fechaUTC(fecha))}${cargando ? '' : `, ${cantidad} turnos`}`} onClick={() => setDia(fecha)}
            variant={fecha === dia ? 'contained' : 'text'} sx={{ minWidth: 0, minHeight: 56, p: 0.5, flexDirection: 'column', borderRadius: 1, color: fecha === dia ? 'primary.contrastText' : actual ? 'text.primary' : 'text.secondary' }}>
            <span>{Number(fecha.slice(-2))}</span>
            <Box component="span" sx={{ fontSize: '0.7rem', minHeight: 16, fontWeight: 700 }}>{!cargando && cantidad > 0 ? cantidad : ''}</Box>
          </Button>;
        })}
      </Box>
      <Typography variant="caption" color="text.secondary">Número: cantidad de turnos del día.</Typography>
    </>}
    {!cargando && <Stack spacing={2} sx={{ mt: 2 }}>
      {!grupos.length && <Alert severity="info">No hay turnos en esta semana con los filtros seleccionados.</Alert>}
      {grupos.map(grupo => <Box component="section" key={grupo.fecha} aria-label={formatoDia.format(fechaUTC(grupo.fecha))}>
        <Typography component="h4" variant="subtitle1" sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1, mb: 1, fontWeight: 700 }}>{formatoDia.format(fechaUTC(grupo.fecha))} · {grupo.turnos.length} {grupo.turnos.length === 1 ? 'turno' : 'turnos'}</Typography>
        {!grupo.turnos.length && <Alert severity="info">No hay turnos para este día.</Alert>}
        <Stack spacing={1.5}>{grupo.turnos.map(t => {
          const inicio = new Date(t.fechaHoraTurno);
          const fin = finTurno(t);
          const paciente = (t as TurnoParaDoctor).paciente;
          const nombre = medico ? `${paciente?.nombre ?? ''} ${paciente?.apellido ?? ''}`.trim() || 'Paciente' : `Dr./Dra. ${t.doctor.nombre} ${t.doctor.apellido}`;
          return <Paper variant="outlined" key={t.id} sx={{ overflow: 'hidden', borderRadius: 2 }}>
            <CardActionArea onClick={() => onSeleccionar(t)} sx={{ p: 2, textAlign: 'left' }}>
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>{formatoHora.format(inicio)}{t.duracionTurnoMinutos ? `–${formatoHora.format(fin)}` : ''}</Typography>
                <Chip size="small" color={colores[t.estado]} label={estadosTurno[t.estado]} />
              </Stack>
              {diaArgentina(inicio) < grupo.fecha && <Typography variant="body2" color="text.secondary">Continúa desde el día anterior</Typography>}
              {diaArgentina(fin) > diaArgentina(inicio) && t.duracionTurnoMinutos && <Typography variant="body2" color="text.secondary">Finaliza el {formatoDia.format(fin)}</Typography>}
              {!t.duracionTurnoMinutos && <Typography variant="body2" color="text.secondary">Duración por verificar</Typography>}
              <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{nombre}</Typography>
              <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{t.doctor.especialidades?.map(e => e.descripcionEsp).join(' · ')}</Typography>
              <Box sx={{ mt: 1.5, border: 1, borderColor: 'primary.main', borderRadius: 1, textAlign: 'center', py: 1, color: 'primary.main', fontWeight: 600 }}>Ver detalle</Box>
            </CardActionArea>
          </Paper>;
        })}</Stack>
      </Box>)}
    </Stack>}
  </Box>;
}
