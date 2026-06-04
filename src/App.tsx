import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './componentes/Layout';
import { MaterialesPage } from './paginas/MaterialesPage';
import { MaterialDetallePage } from './paginas/MaterialDetallePage';
import { NuevoMovimientoPage } from './paginas/NuevoMovimientoPage';
import { ProveedoresPage } from './paginas/ProveedoresPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/materiales" replace />} />
        <Route path="/materiales" element={<MaterialesPage />} />
        <Route path="/materiales/:id" element={<MaterialDetallePage />} />
        <Route path="/movimientos/nuevo" element={<NuevoMovimientoPage />} />
        <Route path="/proveedores" element={<ProveedoresPage />} />
        <Route path="*" element={<Navigate to="/materiales" replace />} />
      </Route>
    </Routes>
  );
}
