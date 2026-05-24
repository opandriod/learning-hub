import api from "./api";

// ✅ GET USER RESULTS (SAFE VERSION)
export const getUserResults = async () => {
  try {
    const response = await api.get("/results");

    // ✅ ensure it's always an array
    if (!Array.isArray(response.data)) {
      console.error("Invalid results format:", response.data);
      return [];
    }

    return response.data;

  } catch (error) {
    console.error("Error fetching results:", error);

    // ✅ prevent UI crash
    return [];
  }
};