import { useEffect, useState } from "react";
import API from "../api/api";

function PaymentReview() {
  const [payments, setPayments] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await API.get("/marketplace/payments/review");
      setPayments(res.data || []);
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to load payments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (p) => {
    setBusyId(p.id);
    setErr("");
    setMsg("");
    try {
      const res = await API.post(`/marketplace/payments/${p.id}/approve`);
      setMsg(res.data.message || "Payment approved. Download unlocked.");
      await load();
    } catch(e) {
      setErr(e.response?.data?.error || "Approve failed.");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (p) => {
    const note = prompt("Reject reason:", "Incorrect/unclear payment proof.") || "Rejected";
    setBusyId(p.id);
    setErr("");
    setMsg("");
    try {
      const res = await API.post(`/marketplace/payments/${p.id}/reject`, { review_note: note });
      setMsg(res.data.message || "Payment rejected.");
      await load();
    } catch(e) {
      setErr(e.response?.data?.error || "Reject failed.");
    } finally {
      setBusyId(null);
    }
  };

  return <div className="pageWrap">
    <div className="pageHeader"><div><h1>Payment Verification</h1><p className="muted">Manually verify UPI screenshot and transaction ID before unlocking downloads.</p></div><button className="secondaryButton" onClick={load} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</button></div>
    {err && <div className="alertError">{err}</div>}{msg && <div className="alertSuccess">{msg}</div>}
    {loading ? <div className="waitBox">Loading payment proofs...</div> : null}
    <div className="card tableWrap"><table><thead><tr><th>Project</th><th>Buyer</th><th>Uploader</th><th>Amount</th><th>Transaction ID</th><th>Status</th><th>Proof</th><th>Action</th></tr></thead><tbody>
      {payments.map(p => <tr key={p.id}><td>{p.project_title}</td><td>{p.buyer_name}<br/><span className="muted">{p.buyer_email}</span></td><td>{p.uploader_name}</td><td>₹{p.amount}</td><td>{p.transaction_id}</td><td>{p.status}</td><td>{p.screenshot_view_url || p.screenshot_url ? <a href={p.screenshot_view_url || p.screenshot_url} target="_blank" rel="noreferrer">Open proof</a> : "No proof"}</td><td>{p.status === "pending" ? <><button className="primaryButton" disabled={busyId === p.id} onClick={() => approve(p)}>{busyId === p.id ? "Approving..." : "Approve"}</button><button className="secondaryButton" disabled={busyId === p.id} onClick={() => reject(p)} style={{ marginLeft: 6 }}>Reject</button></> : p.review_note}</td></tr>)}
    </tbody></table>{!loading && payments.length === 0 && <p className="muted">No payment proofs yet.</p>}</div>
  </div>;
}
export default PaymentReview;
