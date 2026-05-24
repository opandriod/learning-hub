import { useEffect, useState } from "react";
import API from "../api/api";

const typeLabel = { practical: "Practical/Lab", minor: "Minor Project", major: "Major Project" };

function AdminProjectReview() {
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [listing, setListing] = useState({ title: "", description: "", subject_name: "", is_paid: false, price: "0", is_featured: false });
  const [thumbnail, setThumbnail] = useState(null);
  const [screenshots, setScreenshots] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const clear = () => { setMsg(""); setErr(""); };

  const load = async () => {
    try { const res = await API.get("/marketplace/projects/review"); setProjects(res.data || []); }
    catch (e) { setErr(e.response?.data?.error || "Failed to load projects."); }
  };
  useEffect(() => { load(); }, []);

  const openManager = async (p) => {
    clear();
    setBusy(true);
    try {
      const res = await API.get(`/marketplace/projects/${p.id}`);
      const item = res.data;
      setSelected(item);
      setListing({
        title: item.display_title || item.title || "",
        description: item.display_description || item.description || "",
        subject_name: item.subject_name || "",
        is_paid: Boolean(item.is_paid),
        price: item.price || "0",
        is_featured: Boolean(item.is_featured),
      });
      setThumbnail(null);
      setScreenshots([]);
    } catch (e) { setErr(e.response?.data?.error || "Could not open listing manager."); }
    finally { setBusy(false); }
  };

  const saveListing = async () => {
    if (!selected) return;
    clear(); setBusy(true);
    try {
      if (listing.is_paid && Number(listing.price) < 50) {
        setErr("Paid Minor/Major projects must be at least ₹50.");
        setBusy(false);
        return;
      }
      const res = await API.put(`/marketplace/projects/${selected.id}/listing`, listing);
      setMsg(res.data?.message || "Listing updated.");
      await openManager(selected);
      await load();
    } catch (e) { setErr(e.response?.data?.error || "Listing update failed."); }
    finally { setBusy(false); }
  };

  const uploadImages = async () => {
    if (!selected) return;
    clear(); setBusy(true);
    const fd = new FormData();
    if (thumbnail) fd.append("thumbnail", thumbnail);
    Array.from(screenshots).forEach((file) => fd.append("screenshots", file));
    try {
      const res = await API.post(`/marketplace/projects/${selected.id}/images`, fd);
      setMsg(res.data?.message || "Images uploaded.");
      setThumbnail(null); setScreenshots([]);
      await openManager(selected);
      await load();
    } catch (e) { setErr(e.response?.data?.error || "Image upload failed. Make sure the Supabase bucket project-images exists."); }
    finally { setBusy(false); }
  };

  const deleteImage = async (img) => {
    if (!selected || !confirm("Remove this product image?")) return;
    clear();
    try {
      await API.delete(`/marketplace/projects/${selected.id}/images/${img.id}`);
      setMsg("Image removed.");
      await openManager(selected);
      await load();
    } catch (e) { setErr(e.response?.data?.error || "Could not delete image."); }
  };

  const approve = async (p) => {
    let price = p.price || "0";
    if (["minor", "major"].includes(p.project_type)) {
      price = prompt("Final price for Minor/Major project. Enter 0 for free, or at least ₹50 for paid:", p.price || 0);
      if (price === null) return;
      if (Number(price) > 0 && Number(price) < 50) { alert("Paid project price must be at least ₹50."); return; }
    } else {
      alert("Practical/Lab resources are always approved as free. Pricing is only for Minor and Major Projects.");
    }
    const note = prompt("Approval note:", "Approved") || "Approved";
    try { await API.post(`/marketplace/projects/${p.id}/approve`, { price, review_note: note }); setMsg("Resource approved."); load(); }
    catch (e) { setErr(e.response?.data?.error || "Approve failed."); }
  };
  const reject = async (p) => {
    const note = prompt("Reject reason:", "Please include README/source files and improve quality.") || "Rejected";
    try { await API.post(`/marketplace/projects/${p.id}/reject`, { review_note: note }); setMsg("Project rejected."); load(); }
    catch (e) { setErr(e.response?.data?.error || "Reject failed."); }
  };
  const deleteProject = async (p) => {
    if (!confirm("Delete this project permanently? Instructor can delete any project. Admin can delete only own uploaded projects.")) return;
    try { await API.delete(`/marketplace/projects/${p.id}`); setMsg("Project deleted."); if (selected?.id === p.id) setSelected(null); load(); }
    catch (e) { setErr(e.response?.data?.error || "Delete failed."); }
  };

  const archive = async (p) => {
    if (!confirm("Archive this project? It will be hidden from students.")) return;
    try { await API.post(`/marketplace/projects/${p.id}/archive`); setMsg("Project archived."); load(); }
    catch (e) { setErr(e.response?.data?.error || "Archive failed."); }
  };
  const autoArchive = async () => {
    try { const res = await API.post("/marketplace/projects/archive-low-performing"); setMsg(res.data.message); load(); }
    catch (e) { setErr(e.response?.data?.error || "Auto archive failed."); }
  };

  const checkZip = async (p) => {
    try {
      const res = await API.get(`/marketplace/projects/${p.id}/review-file`);
      const url = res.data.download_url;
      if (!url) throw new Error("No review URL returned.");
      window.open(url, "_blank");
    } catch (e) { setErr(e.response?.data?.error || e.message || "Could not open ZIP."); }
  };

  return (
    <div className="pageWrap marketplaceAdminPage">
      <div className="pageHeader"><div><h1>Resource Review</h1><p className="muted">Admin and instructor manage the final store title, description, price, thumbnail, and screenshots.</p></div><button className="secondaryButton" onClick={autoArchive}>Archive Low Performing</button></div>
      {err && <div className="alertError">{err}</div>}{msg && <div className="alertSuccess">{msg}</div>}

      {selected && <div className="card storeListingManager">
        <div className="managerTop">
          <div><h2>Product Listing Manager</h2><p className="muted">This is what students see in the Google Play-style project store.</p></div>
          <button className="secondaryButton" onClick={() => setSelected(null)}>Close</button>
        </div>
        <div className="gridTwo">
          <div className="formGrid">
            <label><span>Store Title</span><input value={listing.title} onChange={(e) => setListing({ ...listing, title: e.target.value })} /></label>
            <label><span>Detailed Description</span><textarea rows="6" value={listing.description} onChange={(e) => setListing({ ...listing, description: e.target.value })} /></label>
            <label><span>Subject / Category Text</span><input value={listing.subject_name} onChange={(e) => setListing({ ...listing, subject_name: e.target.value })} /></label>
            <label><span>Price</span><input type="number" min="0" value={listing.price} disabled={!['minor','major'].includes(selected.project_type)} onChange={(e) => setListing({ ...listing, price: e.target.value, is_paid: Number(e.target.value) > 0 })} /></label>
            {listing.is_paid && <p className="muted">Paid project minimum price is ₹50.</p>}
            <label className="checkRow"><input type="checkbox" checked={listing.is_paid} disabled={!['minor','major'].includes(selected.project_type)} onChange={(e) => setListing({ ...listing, is_paid: e.target.checked })} /> Paid project</label>
            <label className="checkRow"><input type="checkbox" checked={listing.is_featured} onChange={(e) => setListing({ ...listing, is_featured: e.target.checked })} /> Feature in store</label>
            <button className="primaryButton" disabled={busy} onClick={saveListing}>{busy ? "Saving..." : "Save Listing Details"}</button>
          </div>
          <div>
            <h3>Thumbnail & Screenshots</h3>
            <p className="muted">Use a clean thumbnail and at least 3 screenshots, like a Google Play Store game page.</p>
            <label><span>Thumbnail image</span><input type="file" accept="image/*" onChange={(e) => setThumbnail(e.target.files?.[0] || null)} /></label>
            <label><span>Project screenshots</span><input type="file" accept="image/*" multiple onChange={(e) => setScreenshots(e.target.files || [])} /></label>
            <button className="secondaryButton" disabled={busy || (!thumbnail && screenshots.length === 0)} onClick={uploadImages}>{busy ? "Uploading..." : "Upload Images"}</button>
            <div className="adminImageGrid">
              {selected.thumbnail_url && <div><strong>Thumbnail</strong><img src={selected.thumbnail_url} alt="Thumbnail" /></div>}
              {selected.images?.map((img) => <div key={img.id}><img src={img.image_url} alt="Project preview" /><button className="secondaryButton" onClick={() => deleteImage(img)}>Remove</button></div>)}
            </div>
          </div>
        </div>
      </div>}

      <div className="card tableWrap">
        <table><thead><tr><th>Resource</th><th>Uploader</th><th>Semester/Subject</th><th>Type</th><th>Price</th><th>Status</th><th>Rating</th><th>Downloads</th><th>Actions</th></tr></thead><tbody>
          {projects.map(p => <tr key={p.id}>
            <td><strong>{p.display_title || p.title}</strong><br/><span className="muted">{(p.display_description || p.description)?.slice(0, 80)}</span></td>
            <td>{p.uploader_name}<br/><span className="muted">{p.uploader_role}</span></td>
            <td>Sem {p.semester_id || "-"}<br/><span className="muted">{p.subject_name || ""}</span></td><td>{typeLabel[p.project_type] || p.project_type}</td><td>{p.is_paid ? `₹${p.price}` : "Free"}</td><td>{p.status}</td><td>⭐ {p.average_rating} ({p.rating_count})</td><td>{p.download_count}</td>
            <td>
              <button className="primaryButton" disabled={busy} onClick={() => openManager(p)}>Manage Listing</button>
              <button className="secondaryButton" onClick={() => checkZip(p)} style={{ marginLeft: 6 }}>Check ZIP</button>
              {p.status === "pending" ? <>
                <button className="primaryButton" onClick={() => approve(p)} style={{ marginLeft: 6 }}>Approve</button>
                <button className="secondaryButton" onClick={() => reject(p)} style={{ marginLeft: 6 }}>Reject</button>
              </> : <span className="muted" style={{ marginLeft: 6 }}>Reviewed</span>}
              {p.status !== "archived" && <button className="secondaryButton" onClick={() => archive(p)} style={{ marginLeft: 6 }}>Archive</button>}
              <button className="secondaryButton" onClick={() => deleteProject(p)} style={{ marginLeft: 6 }}>Delete</button>
            </td>
          </tr>)}
        </tbody></table>
        {projects.length === 0 && <p className="muted">No resources found.</p>}
      </div>
    </div>
  );
}
export default AdminProjectReview;
