import { verifyReferral, fireRecordImpression, createReferral } from '@/utils/useDatabase';
import Cors from 'cors';
import { withSentry } from '@sentry/nextjs';

// Initializing the cors middleware
const cors = Cors({
  methods: ['GET', 'POST', 'HEAD'],
});

// Helper method to wait for a middleware to execute before continuing
// And to throw an error when an error happens in a middleware
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result)
      }

      return resolve(result)
    })
  })
}

const recordImpression = async (req, res) => {

  console.log('Impression API Call')

  // Run the middleware
  await runMiddleware(req, res, cors);

  const headers = req.headers;
  let body = req.body;
  try {
    body = JSON.parse(body);
  } catch (error) {
    console.log("Could not parse body")
  }
  let filteredReferer = null;
  if(headers?.origin) {
    filteredReferer = headers.origin.replace(/(^\w+:|^)\/\//, '').replace('www.', '');

  } else {
    return res.status(500).json({ statusCode: 500, referer: false });
  }

  try {
    console.log('Trying...')

    if(filteredReferer !== null && body?.referralCode && body?.companyId){
      const referralVerify = await verifyReferral(body?.referralCode, body?.companyId);

      console.log('referralVerify:')
      console.log(referralVerify)
      
      if(referralVerify !== "error" && referralVerify?.affiliate_id && referralVerify?.campaign_id){
        console.log('Referral verified...')

        const impression = await fireRecordImpression(referralVerify?.affiliate_id);

        console.log("Impression:")
        console.log(impression)

        if(impression === "success"){
          const referral = await createReferral(referralVerify);

          if(referral !== "error"){
            return res.status(200).json({ referral_details: referral }); 
          }
        }
      }
    }

    
    return res.status(500).json({ statusCode: 500, verified: false, referrer: filteredReferer });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: { statusCode: 500, verified: false } });

  }
};

export default process.env.SENTRY_AUTH_TOKEN ? withSentry(recordImpression) : recordImpression;