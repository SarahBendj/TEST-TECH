require('dotenv').config()
const express = require('express');
const app = express();
const PORT = process.env.PORT;
const WEBHOOK_URL= process.env.WEBHOOK_URL
const API_KEY =  process.env.API_KEY
const BASE_URL =  process.env.BASE_URL
let jobsStatus = {};

app.use(express.json());


app.get('/compagnies-linkedto-members/:siren', async (req, res) => {
  const { siren } = req.params;
     
   //*CREATE A UNIQUE JOBID BASED ON TIME, CAUSE ITS IRRERSIBLE.
  const jobID = Date.now().toString();

  if (!siren) {
    return res.status(400).json({ error: 'SIREN parameter is required' });
  }

  try {
    jobsStatus[jobID]= { status : 'inProgress' , data : null};
    // Fetch company data by SIREN
    const companyUrl = `${BASE_URL}entreprise?siren=${siren}&api_token=${API_KEY}`;
    const response = await fetch(companyUrl);

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    const companyData = await response.json();

    //*GET RELATED COMPAGNIES LINKED TO MEMBER'S => SHOULD RETURN "MEMBER NAME, COMPAGNIES, SIREN"
    const relatedCompanies = await Promise.all(
      companyData?.representants.map(async (representant) => {
        const memberName = `${representant.prenom_usuel} ${representant.nom}`.replace(',', ' ').trim();

        if( !memberName) {
          throw new Error(`Insufficient data to provide a response: 404`);
      }
      
      try {
         //*INVOLVE DIFFERENT BASES 'query=base' TO RETREIVE INFORMATIONS RELATED TO MEMBERS IF THEY EXIST.
        const getRelatedCompagniesByMemberName = `${BASE_URL}recherche?q=${memberName}&api_token=${API_KEY}&bases=entreprises,dirigeants,beneficiaires,publications&page=1&par_page=20`;
          const response = await fetch(getRelatedCompagniesByMemberName);

          if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
          }

          const relatedCompanies = await response.json()
          return  {
            memberName,
            relatedCompanies: relatedCompanies.resultats.map((company) => ({
            siren: company.siren,
            nom_entreprise: company.nom_entreprise}))
          };
         
         }catch (error) {
              console.error('Error fetching related companies:', error.message);
              return { error: 'Error fetching related companies' };
         }

      })
    );

    //*UPDATE JOBSSTATUS's DATA
    jobsStatus[jobID].data = { relatedCompanies }

     try{
       await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jobsStatus[jobID]),
      })
      } catch (error) {
        console.error('Fetching data failed', error.message);
      };

     //*FINALLY UPDATE THE STATE ,PROOF ALL CODE RAN CORRECTLY
    jobsStatus[jobID].status = 'Done';

    res.json({ jobID, status: jobsStatus[jobID].status });

  } catch (error) {
    console.error('Error fetching company data:', error.message);
    res.status(error.response?.status || 500).json({ error: 'Error fetching company data' });
  }
});

app.get('/jobs-in-progress', (_, res)=> {
  if (Object.keys(jobsStatus).length === 0) {
    //*HANDLE IF NO DATA YET
    res.status(204).json({ message: 'No jobs in progress' });
  } else {
    res.json(jobsStatus);
  }

});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT || 3000 }`);
});
