import { useEffect, useState } from 'react';
import { Alert, Container, LinearProgress, Typography } from '@mui/material';
import { getMisDatosDeDoctor } from '../Servicios/doctoresService';
import type { Doctor } from '../Tipos/dominio';
import EditorAgenda from '../Componentes/EditorAgenda';
import EncabezadoPagina from '../Componentes/EncabezadoPagina';
export default function MiAgenda() {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { getMisDatosDeDoctor().then(setDoctor).catch(e => setError(e.message)); }, []);
  return <Container maxWidth="xl" sx={{ py: 3 }}><EncabezadoPagina><Typography variant="h4" component="h1">Mi agenda</Typography><Typography sx={{ mb: 3 }}>Organizá tus horarios de atención.</Typography></EncabezadoPagina>
    {error ? <Alert severity="error">{error}</Alert> : doctor ? <EditorAgenda doctorId={doctor.matricula} /> : <LinearProgress />}
  </Container>;
}
