import { Navigate, Route, Routes } from 'react-router-dom';
import { EquiposPage } from '@/paginas/EquiposPage';
import { InicioPage } from '@/paginas/InicioPage';
import { ServiciosPage } from '@/paginas/ServiciosPage';
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
        {/* La entrada contesta "que hay que hacer hoy". Antes era el listado
            de 920 materiales, que no contesta nada: hay que saber de antemano
            que buscar. */}
        <Route index element={<InicioPage />} />
        <Route path="/inicio" element={<InicioPage />} />
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
        <Route path="/equipos" element={<EquiposPage />} />
        <Route path="/servicios" element={<ServiciosPage />} />
        <Route path="/proveedores" element={<ProveedoresPage />} />
        <Route
          path="/usuarios"
          element={
            <RutaSoloAdmin>
              <UsuariosPage />
            </RutaSoloAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
