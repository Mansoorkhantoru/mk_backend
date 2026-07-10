const mongoose  = require("mongoose")
const connect = async  ()=>{
    try{
        //  await mongoose.connect(process.env.MONGO_URI);
        // console.log("Connected")
        const mongoURI = process.env.MONGODB_URI;
if (!mongoURI) {
  throw new Error('MONGODB_URI is not defined in environment variables');
}
mongoose.connect(mongoURI); 
    }catch(error){
        console.error(error.message)
    }
}

module.exports = connect; 