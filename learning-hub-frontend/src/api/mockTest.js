import axios from "axios";

const API = "http://localhost:5000/api";

export const fetchMockTest = async (semester, courseId) => {
  const res = await axios.get(`${API}/mock-test/${courseId}`);
  return res.data;
};

export const submitMockTest = async (answers) => {
  const res = await axios.post(`${API}/mock-test/submit`, {
    answers,
  });
  return res.data;
};