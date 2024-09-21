const express = require('express')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const path = require('path')
const jwt=require('jsonwebtoken');
const bcrypt=require('bcrypt');


const app = express()
const dbFilePath = path.join(__dirname, 'covid19IndiaPortal.db')
const PORT_NU = 3000
let db = null
const MY_SECRET_TOKEN="nextWave-ccbp";

const authenticateToken=async(req, res, next)=>{
  let jwtToken;
  const authHeader=req.headers['authorization'];
  if(authHeader!==undefined){
    jwtToken=authHeader.split(" ")[1];
  }
  if(jwtToken==undefined){
    res.status(401);
    res.send("Invalid JWT Token");
  }else{
    jwt.verify(jwtToken, MY_SECRET_TOKEN, async(err, payload)=>{
      if(err){
        res.status(401);
        res.send("Invalid JWT Token");
      }else{
        next();
      }
    });
  }
};

app.use(express.json())

let initializedDbAndServer = async () => {
  try {
    db = await open({
      filename: dbFilePath,
      driver: sqlite3.Database,
    })
    app.listen(PORT_NU, () => {
      console.log(
        'Server is running at https://nitishbfiesnjscpaqlbe.drops.nxtwave.tech',
      )
    })
  } catch (e) {
    console.log('Db error: ', e.message)
    process.exit(1)
  }
}

initializedDbAndServer()

app.post("/login", async(req, res)=>{
  const {username, password}=req.body;
  const selectQuery=`
  SELECT * FROM user where username='${username}';`;
  const dbUser=await db.get(selectQuery);
  if(dbUser===undefined){
    res.status(400);
    res.send("Invalid user");
  }else{
    const isPasswordMatched=await bcrypt.compare(password, dbUser.password);
    if(isPasswordMatched===true){
      let payload={
        username:username
      }
      let jwtToken=jwt.sign(payload, MY_SECRET_TOKEN);
      res.send({jwtToken});
    }else{
      res.status(400);
      res.send("Invalid password");
    }
  }
});

app.get('/states', authenticateToken, async (req, res) => {
  let query = `
    select state_id as stateId, state_name as stateName, population
    from state;`

  let states = await db.all(query)
  res.send(states)
})

app.get('/states/:stateId', authenticateToken, async (req, res) => {
  const {stateId} = req.params

  let query = `select state_id as stateId, state_name as stateName, population
        from state where state_id=${stateId}`

  let state = await db.get(query)
  res.send(state)
})

app.get('/districts/:districtId/', authenticateToken, async (req, res) => {
  const {districtId} = req.params

  let query = `select district_id as districtId,
   district_name as districtName, state_id as stateId, cases, cured, active, deaths
   from district where district_id=${districtId};`

  let state = await db.get(query)
  res.send(state)
})

app.post('/districts', authenticateToken, async (req, res) => {
  const {districtName, stateId, cases, cured, active, deaths} = req.body

  let query = `
    insert into district (district_name, state_id, cases, cured, active, deaths)
    values("${districtName}", ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`

  await db.run(query)
  res.send('District Successfully Added')
})

app.put('/districts/:districtId', authenticateToken, async (req, res) => {
  const {districtName, stateId, cases, cured, active, deaths} = req.body
  const {districtId} = req.params

  let query = `
    update district set
    district_name="${districtName}", 
    state_id=${stateId},
    cases=${cases}, cured=${cured}, 
    active=${active}, deaths=${deaths}
    where district_id=${districtId};`

  await db.run(query)
  res.send('District Details Updated')
})

app.delete('/districts/:districtId/', authenticateToken, async (req, res) => {
  const {districtId} = req.params
  let query = `
    delete from district
    where district_id=${districtId};`

  await db.run(query)
  res.send('District Removed')
})

app.get('/states/:stateId/stats/', authenticateToken, async (req, res) => {
  const {stateId} = req.params
  let query = `
    select sum(cases) as totalCases, sum(cured) as totalCured, 
    sum(active) as totalActive, sum(deaths) as totalDeaths
    from district where state_id=${stateId};
    `

  let dbResponse = await db.get(query)
  res.send(dbResponse)
})

app.get('/districts/:districtId/details/', authenticateToken, async (req, res) => {
  const {districtId} = req.params

  //   let query = `
  //     select state_name as stateName
  //     from district join state on district.state_id = state.state_id
  //     where district_id=${districtId}
  // `

  let query = `
    select state_name as stateName
    from state where 
    state_id=(select state_id from district where district_id=${districtId});
    `

  let state = await db.get(query)
  res.send(state)
})

module.exports = app
