import { useId, useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import ExpandMore from '@mui/icons-material/ExpandMore';

const horaArgentina = (valor: string) => new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(new Date(valor));
const franjas = ['Madrugada', 'Mañana', 'Tarde', 'Noche'];

export default function HorariosPorFranja({ horarios, onContinuar, onSeleccionar }: {
  horarios: string[];
  onSeleccionar?: () => void;
  onContinuar: (horario: string) => void;
}) {
  const id = useId();
  const movil = useMediaQuery(useTheme().breakpoints.down('sm'));
  const grupos = franjas.map((nombre, indice) => ({ nombre, horarios: [...new Set(horarios)]
    .filter(h => Math.floor(Number(horaArgentina(h).slice(0, 2)) / 6) === indice)
    .sort((a, b) => Date.parse(a) - Date.parse(b)) }));
  const [abierta, setAbierta] = useState<number | false>(() => grupos.findIndex(g => g.horarios.length > 0));
  const [cantidad, setCantidad] = useState(0);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const limite = (movil ? 6 : 18) + cantidad;
  const vigente = seleccionado && horarios.includes(seleccionado) ? seleccionado : null;

  return <Box>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Horarios de Argentina · Elegí una franja</Typography>
    {grupos.map((grupo, indice) => <Accordion key={grupo.nombre} expanded={abierta === indice} disabled={!grupo.horarios.length}
      onChange={(_, expandir) => { setAbierta(expandir ? indice : false); setCantidad(0); }}
      disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', mb: 1, borderRadius: 1, '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMore />} id={`${id}-${indice}`} aria-controls={`${id}-${indice}-contenido`}>
        <Typography component="span" sx={{ fontWeight: 700 }}>{grupo.nombre}</Typography>
        <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1, alignSelf: 'center' }}>· {grupo.horarios.length} disponibles</Typography>
      </AccordionSummary>
      <AccordionDetails id={`${id}-${indice}-contenido`}>
        {abierta === indice && <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
            {grupo.horarios.slice(0, limite).map(horario => <Button key={horario} aria-pressed={vigente === horario}
              variant={vigente === horario ? 'contained' : 'outlined'} sx={{ minWidth: 0, minHeight: 44 }}
              onClick={() => { setSeleccionado(horario); onSeleccionar?.(); }}>{horaArgentina(horario)}</Button>)}
          </Box>
          {grupo.horarios.length > limite && <Button sx={{ mt: 1 }} onClick={() => setCantidad(c => c + (movil ? 6 : 18))}>Ver más horarios ({grupo.horarios.length - limite})</Button>}
          {cantidad > 0 && <Button sx={{ mt: 1 }} onClick={() => setCantidad(0)}>Ver menos</Button>}
        </>}
      </AccordionDetails>
    </Accordion>)}
    {vigente && <Stack direction="row" spacing={2} sx={{ mt: 2, p: 2, bgcolor: 'background.paper', border: 1, borderColor: 'primary.main', borderRadius: 2,
      position: { xs: 'sticky', sm: 'static' }, bottom: 8, zIndex: 2, alignItems: 'center', justifyContent: 'space-between' }}>
      <Typography aria-live="polite" sx={{ fontWeight: 700 }}>{new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(vigente))} · {horaArgentina(vigente)}</Typography>
      <Button variant="contained" onClick={() => onContinuar(vigente)}>Continuar</Button>
    </Stack>}
  </Box>;
}
