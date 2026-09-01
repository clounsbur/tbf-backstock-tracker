import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { Boxes, ClipboardList, LayoutDashboard, Map, MoveRight, PackageX, PackagePlus, Search } from "lucide-react";
import { FloorMap } from "./screens/FloorMap";
import { FloorPlan } from "./screens/FloorPlan";
import { InboundContainer } from "./screens/InboundContainer";
import { ReleaseToPicking } from "./screens/ReleaseToPicking";
import { InboundSuggestions } from "./screens/InboundSuggestions";
import { MovePallet } from "./screens/MovePallet";
import { SkuSearch } from "./screens/SkuSearch";
import "./styles.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <Boxes size={24} aria-hidden="true" />
            <div>
              <strong>TBF Backstock</strong>
              <span>Warehouse MVP</span>
            </div>
          </div>
          <nav className="nav-list" aria-label="Primary">
            <NavItem to="/floor-plan" icon={<LayoutDashboard size={18} />} label="Floor Plan" />
            <NavItem to="/floor-map" icon={<Map size={18} />} label="Floor Map" />
            <NavItem to="/sku-search" icon={<Search size={18} />} label="SKU Search" />
            <NavItem to="/move-pallet" icon={<MoveRight size={18} />} label="Move Pallet" />
            <NavItem to="/inbound-container" icon={<PackagePlus size={18} />} label="Incoming Container" />
            <NavItem to="/release" icon={<PackageX size={18} />} label="Release to Picking" />
            <NavItem to="/inbound-suggestions" icon={<ClipboardList size={18} />} label="Inbound Suggestions" />
          </nav>
        </aside>
        <main className="content">
          <Routes>
            <Route path="/" element={<Navigate to="/floor-plan" replace />} />
            <Route path="/floor-plan" element={<FloorPlan />} />
            <Route path="/floor-map" element={<FloorMap />} />
            <Route path="/sku-search" element={<SkuSearch />} />
            <Route path="/move-pallet" element={<MovePallet />} />
            <Route path="/inbound-container" element={<InboundContainer />} />
            <Route path="/release" element={<ReleaseToPicking />} />
            <Route path="/inbound-suggestions" element={<InboundSuggestions />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink to={to} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
