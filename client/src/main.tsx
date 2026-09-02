import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { ClipboardList, LayoutDashboard, Map, MapPin, MoveRight, PackageX, PackagePlus, ScanLine } from "lucide-react";
import { AddLocation } from "./screens/AddLocation";
import { FloorMap } from "./screens/FloorMap";
import { FloorPlan } from "./screens/FloorPlan";
import { InboundContainer } from "./screens/InboundContainer";
import { ReleaseToPicking } from "./screens/ReleaseToPicking";
import { InboundSuggestions } from "./screens/InboundSuggestions";
import { MovePallet } from "./screens/MovePallet";
import { SeedPallet } from "./screens/SeedPallet";
import "./styles.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <img src="/bear-factory-logo.png" alt="The Bear Factory" className="brand-logo" />
            <div>
              <strong>TBF Backstock</strong>
              <span>Warehouse MVP</span>
            </div>
          </div>
          <nav className="nav-list" aria-label="Primary">
            <NavItem to="/floor-plan" icon={<LayoutDashboard size={18} />} label="Floor Plan" />
            <NavItem to="/floor-map" icon={<Map size={18} />} label="Floor Map" />
            <NavItem to="/move-pallet" icon={<MoveRight size={18} />} label="Move Pallet" />
            <NavItem to="/seed-pallet" icon={<ScanLine size={18} />} label="Scan & Store" />
            <NavItem to="/inbound-container" icon={<PackagePlus size={18} />} label="Incoming Container" />
            <NavItem to="/release" icon={<PackageX size={18} />} label="Release to Picking" />
            <NavItem to="/inbound-suggestions" icon={<ClipboardList size={18} />} label="Inbound Suggestions" />
            <NavItem to="/add-location" icon={<MapPin size={18} />} label="Warehouse Setup" />
          </nav>
        </aside>
        <main className="content">
          <Routes>
            <Route path="/" element={<Navigate to="/floor-plan" replace />} />
            <Route path="/floor-plan" element={<FloorPlan />} />
            <Route path="/floor-map" element={<FloorMap />} />
            <Route path="/move-pallet" element={<MovePallet />} />
            <Route path="/seed-pallet" element={<SeedPallet />} />
            <Route path="/inbound-container" element={<InboundContainer />} />
            <Route path="/release" element={<ReleaseToPicking />} />
            <Route path="/inbound-suggestions" element={<InboundSuggestions />} />
            <Route path="/add-location" element={<AddLocation />} />
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
