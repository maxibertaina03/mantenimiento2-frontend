import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './componentes/Layout';
import { RutaSoloAdmin } from './componentes/RutaSoloAdmin';
import { EquiposItPage } from './paginas/EquiposItPage';
import { MaterialesPage } from './paginas/MaterialesPage';
import { MaterialDetallePage } from './paginas/MaterialDetallePage';
import { MovimientosPage } from './paginas/MovimientosPage';
import { NuevoMovimientoPage } from './paginas/NuevoMovimientoPage';
import { OrdenesCompraPage } from './paginas/OrdenesCompraPage';
import { ProveedoresPage } from './paginas/ProveedoresPage';
import { UsuariosPage } from './paginas/UsuariosPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/materiales" replace />} />
        <Route path="/materiales" element={<MaterialesPage />} />
        <Route path="/materiales/:id" element={<MaterialDetallePage />} />
        <Route path="/movimientos" element={<MovimientosPage />} />
        <Route path="/movimientos/nuevo" element={<NuevoMovimientoPage />} />
        <Route path="/ordenes-compra" element={<OrdenesCompraPage />} />
        <Route
          path="/equipos-it"
          element={
            <RutaSoloAdmin>
              <EquiposItPage />
            </RutaSoloAdmin>
          }
        />
        <Route path="/proveedores" element={<ProveedoresPage />} />
        <Route
          path="/usuarios"
          element={
            <RutaSoloAdmin>
              <UsuariosPage />
            </RutaSoloAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/materiales" replace />} />
      </Route>
    </Routes>
  );
}
