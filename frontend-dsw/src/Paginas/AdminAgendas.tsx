import { useEffect, useState } from 'react';
import { Alert, Autocomplete, Container, TextField, Typography } from '@mui/material';
import { getDoctores } from '../Servicios/doctoresService';
import type { Doctor } from '../Tipos/dominio';
import EditorAgenda from '../Componentes/EditorAgenda';
import EncabezadoPagina from '../Componentes/EncabezadoPagina';

export default function AdminAgendas() {
  const [doctores, setDoctores] = useState<Doctor[]>([]);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { getDoctores().then(setDoctores).catch(e => setError(e.message)); }, []);
  return <Container maxWidth="xl" sx={{ py: 3 }}><EncabezadoPagina><Typography variant="h4" component="h1">Gestionar agendas</Typography><Typography>Seleccioná un profesional y organizá su semana.</Typography></EncabezadoPagina>
    {error && <Alert severity="error">{error}</Alert>}
    <Autocomplete options={doctores} value={doctor} sx={{ my: 3 }} getOptionLabel={d => `${d.nombre} ${d.apellido} · ${d.matricula}${d.activo === false ? ' · Dado de baja' : ''}`} isOptionEqualToValue={(a, b) => a.matricula === b.matricula}
      onChange={(_, value) => { if (!dirty || window.confirm('¿Descartar los cambios sin guardar y cambiar de profesional?')) { setDirty(false); setDoctor(value); } }} renderInput={params => <TextField {...params} label="Profesional: nombre o matrícula" />} />
    {doctor ? <EditorAgenda key={doctor.matricula} doctorId={doctor.matricula} onDirty={setDirty} /> : <Alert severity="info">Elegí un profesional para consultar o editar sus horarios.</Alert>}
  </Container>;
}
