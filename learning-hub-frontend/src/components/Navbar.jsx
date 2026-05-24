function Navbar() {
  const role = localStorage.getItem("role");
  const name = localStorage.getItem("name") || "User";

  return (
    <div className="navbar">
      <div>
        <strong>{role === "admin" ? "Admin" : "Student"}</strong>
      </div>
      <div className="navbarActions">
        <div className="muted">Signed in as {name}</div>
        
      </div>
    </div>
  );
}

export default Navbar;
