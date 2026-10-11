import mongoose from "mongoose";

// Defence in depth against operator injection: any key starting with "$"
// inside a query filter built from user input is wrapped as a literal.
mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

export async function connectDb(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  return mongoose.connection;
}

export const disconnectDb = () => mongoose.disconnect();
