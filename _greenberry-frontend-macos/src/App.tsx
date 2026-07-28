import { useEffect, useState } from "react";
import { Gallery } from "./ui/Gallery";
import { ConnectScreen, type Session } from "./app/ConnectScreen";
import { Workspace } from "./app/Workspace";
import { workspace } from "./lib/workspace";
import "./App.css";
import "./app/workspace.css";

function App() {
  const [session, setSession] = useState<Session | null>(null);

  // S11.2: load connections / history / settings from the SQLite app-db.
  useEffect(() => {
    void workspace.hydrate();
  }, []);

  if (typeof window !== "undefined" && window.location.hash === "#gallery") {
    return <Gallery />;
  }

  if (!session) {
    return <ConnectScreen onConnected={setSession} />;
  }

  // The Workspace owns a per-database connection pool (pgAdmin-style tree)
  // and closes every pooled connection itself before calling onDisconnect.
  return (
    <Workspace
      key={session.connectionId}
      conn={session.conn}
      config={session.config}
      initialConnectionId={session.connectionId}
      initialCatalog={session.catalog}
      databases={session.databases}
      roles={session.roles}
      onDisconnect={() => setSession(null)}
    />
  );
}

export default App;
