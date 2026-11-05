import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Card, CardActionArea, Container, Dialog, DialogContent, DialogTitle, IconButton, Link, Skeleton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PhoneOutlined from '@mui/icons-material/PhoneOutlined';
import PlaceOutlined from '@mui/icons-material/PlaceOutlined';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined';
import ArrowForward from '@mui/icons-material/ArrowForward';
import ChevronRight from '@mui/icons-material/ChevronRight';
import LocalHospital from '@mui/icons-material/LocalHospital';
import IconoEspecialidad from '../Componentes/IconoEspecialidad';
import { getEspecialidades } from '../Servicios/especialidadesService';
import type { Especialidad } from '../Tipos/dominio';

const DIRECCION = 'Silent Hill, Estados Unidos';
// Número ficticio para la demostración; no habilitar llamadas reales.
const TELEFONO = 'bebetón (555) 555-5555';
const pasos = [
  ['Elegí una especialidad', 'Buscá la especialidad o el profesional con quien querés atenderte.'],
  ['Seleccioná fecha y horario', 'Elegí entre los turnos disponibles el que te resulte más cómodo.'],
  ['Confirmá tu turno', 'Ingresá a tu cuenta o registrate y confirmá tu reserva.'],
];

export default function Inicio() {
  const [contactoAbierto, setContactoAbierto] = useState(false);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let vigente = true;
    getEspecialidades(true).then(datos => { if (vigente) setEspecialidades(datos); }) 
      .catch(() => { if (vigente) setError(true); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, []);

  return <>
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      <Box component="section" aria-labelledby="inicio-titulo" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, bgcolor: 'primary.light', borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ p: { xs: 3, md: 5 }, alignSelf: 'center' }}>
          <Typography id="inicio-titulo" component="h1" sx={{ color: 'primary.dark', fontWeight: 750, fontSize: { xs: '2.2rem', md: '3rem' }, lineHeight: 1.12, mb: 2 }}>Tu próxima consulta, más simple.</Typography>
          <Typography sx={{ fontSize: { xs: '1rem', md: '1.15rem' }, mb: 3, color: 'text.secondary' }}>Encontrá tu especialidad y reservá un turno online.</Typography>
          <Stack direction={{ xs: 'column', sm: 'row', md: 'column', lg: 'row' }} spacing={1.5}>
            <Button component={RouterLink} to="/reserva" variant="contained" startIcon={<CalendarMonthOutlined />}>Reservar un turno</Button>
            <Button component={RouterLink} to="/mis-turnos?pendientes=1" variant="outlined" startIcon={<AssignmentOutlined />}>Ver mis turnos</Button>
          </Stack>
        </Box>
        <Box component="figure" sx={{ m: 0, position: 'relative', minHeight: { xs: 220, md: 390 } }}>
          <Box component="img" src="/images/inicio-raiden-doctor.png" alt="Raiden vestido de médico atiende a un paciente en el consultorio" fetchPriority="high" width={1536} height={1024}
            sx={{ display: 'block', width: '100%', height: '100%', position: { md: 'absolute' }, objectFit: 'cover', maxHeight: { xs: 310, md: 'none' } }} />
        </Box>
      </Box>
      <Box component="section" aria-labelledby="inicio-especialidades" sx={{ my: { xs: 4, md: 5 } }}>
        <Typography id="inicio-especialidades" component="h2" variant="h4" sx={{ mb: 2.5 }}>Encontrá tu especialidad</Typography>
        {error ? <Alert severity="warning">No pudimos cargar las especialidades. Intentá nuevamente desde el listado.</Alert>
          : !cargando && especialidades.length === 0 ? <Alert severity="info">Por el momento no hay especialidades disponibles.</Alert>
            : <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }, gap: { xs: 1.5, md: 2 } }}>
              {cargando ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} variant="rounded" height={110} />)
                : especialidades.slice(0, 6).map(esp => <Card key={esp.idEspecialidad} variant="outlined">
                  <CardActionArea component={RouterLink} to={`/especialidades/${esp.idEspecialidad}/turnos`} sx={{ p: { xs: 2, md: 2.5 }, minHeight: 110, height: '100%', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1.5, textAlign: { xs: 'center', md: 'left' } }}>
                    <IconoEspecialidad icono={esp.icono} />
                    <Typography sx={{ fontWeight: 600, flex: 1, overflowWrap: 'anywhere' }}>{esp.descripcionEsp}</Typography>
                    <ChevronRight sx={{ display: { xs: 'none', md: 'block' } }} />
                  </CardActionArea>
                </Card>)}
            </Box>}
        <Box sx={{ textAlign: 'center', mt: 2 }}><Button component={RouterLink} to="/especialidades" endIcon={<ArrowForward />}>
        Ver todas las especialidades</Button></Box>
      </Box>
      <Box component="section" aria-labelledby="inicio-pasos" sx={{ bgcolor: 'primary.light', borderRadius: 3, p: { xs: 3, md: 4 } }}>
        <Typography id="inicio-pasos" component="h2" variant="h4" sx={{ mb: 3 }}>Reservá en 3 pasos</Typography>
        <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
          {pasos.map(([titulo, descripcion], i) => <Stack component="li" key={titulo} direction="row" spacing={2}>
            <Box aria-hidden="true" sx={{ bgcolor: '#F1E2B9', color: 'primary.dark', borderRadius: '50%', width: 48, height: 48, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: '1.4rem', fontWeight: 700 }}>{i + 1}</Box>
            <Box><Typography component="h3" variant="h6" sx={{ mb: 0.5 }}>{titulo}</Typography><Typography color="text.secondary">{descripcion}</Typography></Box>
          </Stack>)}
        </Box>
      </Box>
      <Box component="section" id="contacto" aria-labelledby="inicio-contacto" sx={{ mt: { xs: 4, md: 5 }, mb: 2, scrollMarginTop: 100 }}>
        <Typography id="inicio-contacto" component="h2" variant="h4" sx={{ mb: 2.5 }}>¿Necesitás ayuda?</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Card variant="outlined"><CardActionArea onClick={() => setContactoAbierto(true)} sx={{ p: 3, display: 'flex', justifyContent: 'flex-start', gap: 2 }}>
            <PhoneOutlined color="primary" sx={{ fontSize: 36 }} /><Box><Typography component="h3" variant="h6">Consultar por teléfono</Typography><Typography color="text.secondary">{TELEFONO} </Typography></Box>
          </CardActionArea></Card>
          <Card variant="outlined"><CardActionArea component="a" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(DIRECCION)}`} target="_blank" rel="noopener noreferrer" aria-label={`Cómo llegar a ${DIRECCION} (abre en otra pestaña)`} sx={{ p: 3, display: 'flex', justifyContent: 'flex-start', gap: 2 }}>
            <PlaceOutlined color="primary" sx={{ fontSize: 36 }} /><Box><Typography component="h3" variant="h6">Cómo llegar</Typography><Typography color="text.secondary">{DIRECCION}</Typography></Box>
          </CardActionArea></Card>
        </Box>
      </Box>
    </Container>
    <Box component="footer" sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', py: 3, mt: 2 }}>
      <Container maxWidth="lg"><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><LocalHospital /><Typography sx={{ fontWeight: 700 }}>HOSPITAL RIPPER</Typography></Stack>
        <Stack component="nav" aria-label="Enlaces del pie de página" direction="row" spacing={2}>
          <Link component={RouterLink} to="/reserva" color="inherit">Turnos</Link><Link component={RouterLink} to="/especialidades" color="inherit">Especialidades</Link><Link href="#contacto" color="inherit">Contacto</Link>
        </Stack>
      </Stack></Container>
    </Box>
    <Dialog open={contactoAbierto} onClose={() => setContactoAbierto(false)} maxWidth="xs" fullWidth aria-labelledby="contacto-titulo">
      <DialogTitle id="contacto-titulo" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>Contacto telefónico<IconButton aria-label="Cerrar contacto" onClick={() => setContactoAbierto(false)}><CloseIcon /></IconButton></DialogTitle>
      <DialogContent><Typography variant="h5" sx={{ mb: 2 }}>{TELEFONO}</Typography><Alert severity="info">Número ficticio de demostración. Para reservar un turno, usá la reserva online.</Alert><Button component={RouterLink} to="/reserva" variant="contained" sx={{ mt: 2 }}>Reservar un turno</Button></DialogContent>
    </Dialog>
  </>;
}

