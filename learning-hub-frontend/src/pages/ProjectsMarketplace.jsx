import { useEffect, useMemo, useState } from "react";
import API from "../api/api";
import { SkeletonGrid } from "../components/Skeleton";

const typeLabel = { practical: "Practical/Lab", minor: "Minor Project", major: "Major Project" };

function getAccessLabel(project) {
  if (!project?.is_paid) return "Free";
  if (project.has_access || project.purchase_status === "approved") return "Purchased";
  if (project.purchase_status === "pending") return "Payment Started";
  if (project.purchase_status === "rejected") return "Payment Rejected";
  return `₹${project.price}`;
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function ProjectsMarketplace() {
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [upi, setUpi] = useState(null);
  const [proof, setProof] = useState(null);
  const [transactionId, setTransactionId] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [filters, setFilters] = useState({ q: "", semester_id: "", project_type: "" });
  const [activeStoreChip, setActiveStoreChip] = useState("my");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [openingId, setOpeningId] = useState(null);
  const [loadingUpi, setLoadingUpi] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [savingRating, setSavingRating] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [simulatingId, setSimulatingId] = useState(null);

  const testPaymentSimulatorEnabled = String(import.meta.env.VITE_ENABLE_TEST_PAYMENT_SIMULATOR || "").toLowerCase() === "true";

  const selectedCanDownload = useMemo(() => {
    if (!selected) return false;
    return !selected.is_paid || selected.has_access || selected.purchase_status === "approved";
  }, [selected]);

  const clearNotice = () => {
    setMsg("");
    setErr("");
  };

  const load = async () => {
    setLoading(true);
    setErr("");
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.append(k, v));
    try {
      const res = await API.get(`/marketplace/projects?${params.toString()}`);
      setProjects(res.data || []);
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openProject = async (id, options = {}) => {
    if (selected?.id === id && !options.keepNotice) {
      setSelected(null);
      return;
    }
    if (!options.keepNotice) clearNotice();
    setUpi(null);
    setProof(null);
    setTransactionId("");
    setOpeningId(id);
    try {
      const res = await API.get(`/marketplace/projects/${id}`);
      setSelected(res.data);
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to open project.");
    } finally {
      setOpeningId(null);
    }
  };

  const startRazorpayPayment = async (project) => {
    if (!project) return;
    clearNotice();
    setPayingId(project.id);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Could not load Razorpay Checkout. Check your internet connection.");

      const orderRes = await API.post(`/marketplace/projects/${project.id}/razorpay/order`);
      if (orderRes.data?.purchase_status === "approved") {
        setMsg("You already purchased this project. Download is unlocked.");
        await load();
        await openProject(project.id, { keepNotice: true });
        return;
      }

      const order = orderRes.data;
      const options = {
        key: order.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency || "INR",
        name: "Only Learning Hub",
        description: order.project?.title || project.title,
        order_id: order.order_id,
        notes: { project_id: String(project.id), purchase_id: String(order.purchase_id) },
        theme: { color: "#2563eb" },
        handler: async (response) => {
          setPayingId(project.id);
          try {
            const verifyRes = await API.post(`/marketplace/projects/${project.id}/razorpay/verify`, {
              purchase_id: order.purchase_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setMsg(verifyRes.data?.message || "Payment successful. Download unlocked.");
            await load();
            await openProject(project.id, { keepNotice: true });
          } catch (e) {
            setErr(e.response?.data?.error || "Payment verification failed. Do not retry if money was deducted; contact admin.");
          } finally {
            setPayingId(null);
          }
        },
        modal: {
          ondismiss: () => setPayingId(null),
        },
      };

      if (!options.key) throw new Error("VITE_RAZORPAY_KEY_ID is not configured in Vercel/frontend.");
      const rz = new window.Razorpay(options);
      rz.on("payment.failed", (response) => {
        setErr(response?.error?.description || "Payment failed or was cancelled.");
        setPayingId(null);
      });
      rz.open();
    } catch (e) {
      setErr(e.response?.data?.error || e.message || "Could not start Razorpay payment.");
      setPayingId(null);
    }
  };

  const simulateTestPaymentSuccess = async (project) => {
    if (!project) return;
    clearNotice();
    setSimulatingId(project.id);
    try {
      const orderRes = await API.post(`/marketplace/projects/${project.id}/razorpay/order`);
      if (orderRes.data?.purchase_status === "approved") {
        setMsg("You already purchased this project. Download is unlocked.");
        await load();
        await openProject(project.id, { keepNotice: true });
        return;
      }

      const order = orderRes.data;
      const simRes = await API.post(`/marketplace/projects/${project.id}/razorpay/test-success`, {
        purchase_id: order.purchase_id,
        razorpay_order_id: order.order_id,
      });
      setMsg(simRes.data?.message || "Test payment simulated. Download unlocked.");
      await load();
      await openProject(project.id, { keepNotice: true });
    } catch (e) {
      setErr(e.response?.data?.error || e.message || "Could not simulate test payment. Check Render ENABLE_TEST_PAYMENT_SIMULATOR.");
    } finally {
      setSimulatingId(null);
    }
  };


  const getUpi = async () => {
    if (!selected) return;
    setLoadingUpi(true);
    clearNotice();
    try {
      const res = await API.get(`/marketplace/projects/${selected.id}/upi`);
      setUpi(res.data);
    } catch (e) {
      setErr(e.response?.data?.error || "Could not load UPI QR.");
    } finally {
      setLoadingUpi(false);
    }
  };

  const submitProof = async () => {
    if (!selected) return;
    clearNotice();
    if (!proof || !transactionId.trim()) {
      setErr("Upload payment screenshot and enter transaction ID.");
      return;
    }
    setSubmittingProof(true);
    const fd = new FormData();
    fd.append("screenshot", proof);
    fd.append("transaction_id", transactionId.trim());
    try {
      const res = await API.post(`/marketplace/projects/${selected.id}/purchase-proof`, fd);
      setMsg(res.data?.message || "Payment proof submitted. Waiting for admin/instructor approval.");
      setProof(null);
      setTransactionId("");
      setUpi(null);
      await load();
      await openProject(selected.id, { keepNotice: true });
    } catch (e) {
      setErr(e.response?.data?.error || "Payment proof failed.");
      if (e.response?.data?.purchase_status === "pending") {
        await load();
        await openProject(selected.id, { keepNotice: true });
      }
    } finally {
      setSubmittingProof(false);
    }
  };

  const download = async (p) => {
    clearNotice();
    setDownloadingId(p.id);
    try {
      const res = await API.get(`/marketplace/projects/${p.id}/download`);
      const url = res.data.download_url || res.data.file_url;
      if (!url) throw new Error("No download URL returned.");
      window.open(url, "_blank");
      setMsg(res.data.message || "Download started.");
      await load();
      if (selected?.id === p.id) await openProject(p.id, { keepNotice: true });
    } catch (e) {
      setErr(e.response?.data?.error || e.message || "Download failed.");
    } finally {
      setDownloadingId(null);
    }
  };

  const saveRating = async () => {
    if (!selected) return;
    clearNotice();
    setSavingRating(true);
    try {
      await API.post(`/marketplace/projects/${selected.id}/rate`, { rating, comment });
      setMsg("Rating saved.");
      setComment("");
      await openProject(selected.id, { keepNotice: true });
      await load();
    } catch (e) {
      setErr(e.response?.data?.error || "Rating failed.");
    } finally {
      setSavingRating(false);
    }
  };

  const studentSemesterId = localStorage.getItem("semester_id") || "";

  const filteredProjects = useMemo(() => {
    const query = filters.q.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesQuery = !query || [project.title, project.description, project.subject_name, project.uploader_name, project.project_type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
      const matchesChip =
        activeStoreChip === "all" ||
        (activeStoreChip === "my" && (!studentSemesterId || String(project.semester_id || "") === String(studentSemesterId))) ||
        (activeStoreChip === "free" && !project.is_paid) ||
        (activeStoreChip === "paid" && project.is_paid) ||
        (activeStoreChip === "minor" && project.project_type === "minor") ||
        (activeStoreChip === "major" && project.project_type === "major") ||
        (activeStoreChip === "practical" && project.project_type === "practical");
      return matchesQuery && matchesChip;
    });
  }, [projects, filters.q, activeStoreChip, studentSemesterId]);

  const storeChips = [
    { id: "my", label: studentSemesterId ? `Semester ${studentSemesterId}` : "My Semester" },
    { id: "all", label: "All" },
    { id: "free", label: "Free" },
    { id: "paid", label: "Paid" },
    { id: "minor", label: "Minor" },
    { id: "major", label: "Major" },
    { id: "practical", label: "Lab" },
  ];

  const storeSections = useMemo(() => {
    const unique = (items) => Array.from(new Map(items.map((item) => [item.id, item])).values());
    const featured = filteredProjects.filter((p) => p.is_featured).slice(0, 10);
    const recent = [...filteredProjects].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 10);
    const free = filteredProjects.filter((p) => !p.is_paid).slice(0, 10);
    const paid = filteredProjects.filter((p) => p.is_paid).slice(0, 10);
    const projectBased = filteredProjects.filter((p) => ["minor", "major"].includes(p.project_type)).slice(0, 10);
    const sections = [
      { title: "Featured", subtitle: "Recommended resources", items: featured },
      { title: "Recently Added", subtitle: "Newest uploads", items: recent },
      { title: "Free Resources", subtitle: "Ready to download", items: free },
      { title: "Paid Projects", subtitle: "Minor and major projects", items: paid },
      { title: "Minor/Major Projects", subtitle: "Project paper resources", items: projectBased },
    ].map((section) => ({ ...section, items: unique(section.items) }));
    return sections.filter((section) => section.items.length > 0);
  }, [filteredProjects]);

  const renderAction = (p) => {
    const canDownload = !p.is_paid || p.has_access || p.purchase_status === "approved";
    if (canDownload) {
      return <button className="primaryButton" disabled={downloadingId === p.id} onClick={() => download(p)}>{downloadingId === p.id ? "Preparing..." : "Download"}</button>;
    }
    if (p.purchase_status === "pending") {
      return <button className="secondaryButton" onClick={() => openProject(p.id)}>Complete Payment</button>;
    }
    return <button className="primaryButton" disabled={payingId === p.id} onClick={() => startRazorpayPayment(p)}>{payingId === p.id ? "Opening..." : "Pay with Razorpay"}</button>;
  };

  return <div className="pageWrap marketplacePage projectStorePlayPage">
    <div className="card storeHeroCard">
      <div>
        <span className="sectionEyebrow">Project Store</span>
        <h1>Project & Practical Store</h1>
        <p className="muted">Browse practical resources and approved Minor/Major projects. Start with your semester, then filter like an app store.</p>
      </div>
    </div>

    {err && <div className="alertError">{err}</div>}
    {msg && <div className="alertSuccess">{msg}</div>}

    <div className="card storeSearchCard">
      <input placeholder="Search projects" value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })}/>
      <div className="storeChipRail" aria-label="Project filters">
        {storeChips.map((chip) => (
          <button
            type="button"
            key={chip.id}
            className={`storeFilterChip ${activeStoreChip === chip.id ? "active" : ""}`}
            onClick={() => setActiveStoreChip(chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <button className="primaryButton storeSearchButton" disabled={loading} onClick={load}>{loading ? "Loading..." : "Refresh"}</button>
    </div>

    {loading ? <SkeletonGrid count={4} /> : null}

    {!loading && storeSections.length === 0 ? <div className="card emptyStoreCard"><p className="muted">No approved resources found for this filter.</p></div> : null}

    {!loading && storeSections.map((section) => (
      <section className="storeShelf" key={section.title}>
        <div className="storeShelfHeader">
          <div>
            <h2>{section.title}</h2>
            <p>{section.subtitle}</p>
          </div>
          <span>{section.items.length} item{section.items.length === 1 ? "" : "s"}</span>
        </div>
        <div className="storeShelfRail">
          {section.items.map(p => <div className="card projectStoreCard playStoreCard storeMiniCard" key={`${section.title}-${p.id}`}>
            <div className="storeThumbWrap">
              {p.thumbnail_url ? <img src={p.thumbnail_url} alt={p.title} className="storeThumb" /> : <div className="storeThumbPlaceholder">LH</div>}
              <span className="storePriceBadge">{getAccessLabel(p)}</span>
            </div>
            <div className="storeCardBody">
              <h3>{p.title}</h3>
              <p className="storeMeta">⭐ {p.average_rating} ({p.rating_count}) • {p.download_count} downloads</p>
              <p className="muted storeMiniMeta">Semester {p.semester_id || "-"} • {typeLabel[p.project_type] || p.project_type}</p>
              <p className="muted storeDescription">{p.description?.slice(0, 80)}{p.description?.length > 80 ? "..." : ""}</p>
              <div className="projectActions">
                <button className="secondaryButton" disabled={openingId === p.id} onClick={() => openProject(p.id)}>{openingId === p.id ? "Opening..." : selected?.id === p.id ? "Hide" : "View"}</button>
                {renderAction(p)}
              </div>

              {selected?.id === p.id && <div className="inlineProjectDetail playStoreDetail">
                <div className="projectHero">
                  {selected.thumbnail_url ? <img src={selected.thumbnail_url} alt={selected.title} className="detailThumb" /> : <div className="detailThumb detailThumbPlaceholder">LH</div>}
                  <div>
                    <h2>{selected.title}</h2>
                    <p className="muted">By {selected.uploader_name}</p>
                    <p>⭐ {selected.average_rating} ({selected.rating_count}) • Downloads {selected.download_count} • Semester {selected.semester_id || "-"} • {typeLabel[selected.project_type] || selected.project_type} • {selected.subject_name}</p>
                    <div className="detailActionRow">
                      {selectedCanDownload ? <button className="primaryButton" disabled={downloadingId === selected.id} onClick={() => download(selected)}>{downloadingId === selected.id ? "Preparing..." : "Download Resource"}</button> : null}
                      <button className="secondaryButton" onClick={() => setSelected(null)}>Close</button>
                    </div>
                  </div>
                </div>

                {selected.screenshots?.length ? <div className="projectPreviewGallery">
                  <h3>Project Preview</h3>
                  <div className="screenshotRail">
                    {selected.screenshots.map((img) => <a key={img.id} href={img.image_url} target="_blank" rel="noreferrer"><img src={img.image_url} alt="Project screenshot" /></a>)}
                  </div>
                </div> : <div className="emptyPreviewBox">No preview screenshots were uploaded yet.</div>}

                <div className="projectAboutBox">
                  <h3>About this project</h3>
                  <p>{selected.description}</p>
                </div>

                {selected.is_paid && !selectedCanDownload ? <div className="paymentBox">
                  <h3>Secure Payment</h3>
                  <p>Pay safely with Razorpay using UPI, cards, net banking, or wallets. Your download unlocks automatically after payment verification.</p>
                  {selected.purchase_status === "pending" ? <div className="waitBox">Payment was started but not completed. You can try Razorpay again.</div> : null}
                  {selected.purchase_status === "rejected" ? <div className="alertError">Your previous manual payment proof was rejected. Razorpay payment is recommended.</div> : null}
                  <button className="primaryButton paymentPrimary" disabled={payingId === selected.id || simulatingId === selected.id} onClick={() => startRazorpayPayment(selected)}>{payingId === selected.id ? "Opening Razorpay..." : `Pay ₹${selected.price} with Razorpay`}</button>

                  {testPaymentSimulatorEnabled ? <div className="testPaymentBox">
                    <strong>Test Mode Demo Helper</strong>
                    <p className="muted">Use this only when Razorpay Test Mode keeps declining or timing out. Backend must also have ENABLE_TEST_PAYMENT_SIMULATOR=true.</p>
                    <button className="secondaryButton" disabled={simulatingId === selected.id || payingId === selected.id} onClick={() => simulateTestPaymentSuccess(selected)}>{simulatingId === selected.id ? "Unlocking demo..." : "Simulate Test Success"}</button>
                  </div> : null}

                  <details className="manualPaymentDetails">
                    <summary>Manual UPI backup</summary>
                    <p>Use manual UPI only if Razorpay is unavailable. Download unlocks after admin/instructor approval.</p>
                    <button className="secondaryButton" disabled={loadingUpi} onClick={getUpi}>{loadingUpi ? "Loading QR..." : "Show UPI QR"}</button>
                    {upi && <div className="upiPanel">
                      <p><strong>Amount:</strong> ₹{upi.amount}</p>
                      <p><strong>UPI ID:</strong> {upi.upi_id}</p>
                      {upi.qr_data_url ? <img src={upi.qr_data_url} alt="UPI QR" className="upiQr" /> : <p>QR package not installed. Copy UPI link below.</p>}
                      <p><a href={upi.upi_link}>Open UPI Link</a></p>
                      <button className="secondaryButton" type="button" onClick={() => navigator.clipboard.writeText(upi.upi_link)}>Copy UPI Link</button>
                    </div>}
                    <label><span>Payment screenshot</span><input type="file" accept="image/*,.pdf" onChange={e => setProof(e.target.files[0])}/></label>
                    <label><span>UPI Transaction ID</span><input placeholder="Example: 412345678901" value={transactionId} onChange={e => setTransactionId(e.target.value)} /></label>
                    <button className="secondaryButton" disabled={submittingProof} onClick={submitProof}>{submittingProof ? "Submitting..." : "Submit Manual Proof"}</button>
                  </details>
                </div> : null}

                <div className="projectRatingBox">
                  <h3>Rate this project</h3>
                  <select value={rating} onChange={e => setRating(Number(e.target.value))}>{[5,4,3,2,1].map(n => <option key={n} value={n}>{n} stars</option>)}</select>
                  <input placeholder="Optional comment" value={comment} onChange={e => setComment(e.target.value)} />
                  <button className="secondaryButton" disabled={savingRating} onClick={saveRating}>{savingRating ? "Saving..." : "Save Rating"}</button>
                </div>
                <h3>Reviews</h3>{selected.reviews?.length ? selected.reviews.map((r, i)=><p key={i}><strong>{r.name}</strong>: ⭐ {r.rating} {r.comment}</p>) : <p className="muted">No reviews yet.</p>}
              </div>}
            </div>
          </div>)}
        </div>
      </section>
    ))}
  </div>;
}
export default ProjectsMarketplace;
