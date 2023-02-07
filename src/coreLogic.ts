import { namespaceWrapper } from "./namespaceWrapper";

export async function task() {
  // Write the logic to do the work required for submitting the values and optionally store the result in levelDB
}
async function fetchSubmission() {
  // Write the logic to fetch the submission values here and return the cid string
}

async function generateDistributionList() {
  console.log("GenerateDistributionList called");
  console.log("I am selected node");

  // Write the logic to generate the distribution list here by introducing the rules of your choice

  /*  **** SAMPLE LOGIC FOR GENERATING DISTRIBUTION LIST ******
  
  let distributionList = {};
    const taskAccountDataJSON = await namespaceWrapper.getTaskState();
    const submissions = taskAccountDataJSON.submissions[round];
    const submissions_audit_trigger =
                  taskAccountDataJSON.submissions_audit_trigger[round];
    if (submissions == null) {
      console.log("No submisssions found in N-2 round");
      return distributionList;
    } else {
      const keys = Object.keys(submissions);
      const values = Object.values(submissions);
      const size = values.length;
      console.log("Submissions from last round: ", keys, values, size);
      for (let i = 0; i < size; i++) {
        const candidatePublicKey = keys[i];
        if (submissions_audit_trigger && submissions_audit_trigger[candidatePublicKey]) {
          console.log(submissions_audit_trigger[candidatePublicKey].votes, "distributions_audit_trigger votes ");
          const votes = submissions_audit_trigger[candidatePublicKey].votes;
          let numOfVotes = 0;
          for (let index = 0; index < votes.length; index++) {
            if(votes[i].is_valid)
              numOfVotes++;
            else numOfVotes--;
          }
          if(numOfVotes < 0)
            continue;
        }
        distributionList[candidatePublicKey] = 1;  
      }
    } */
}

export async function submitDistributionList(round) {
  console.log("SubmitDistributionList called");

  const distributionList = await generateDistributionList();

  const decider = await namespaceWrapper.uploadDistributionList(
    distributionList,
    round
  );
  console.log("DECIDER", decider);

  if (decider) {
    const response = await namespaceWrapper.distributionListSubmissionOnChain(
      round
    );
    console.log("RESPONSE FROM DISTRIBUTION LIST", response);
  }
}

export async function validateNode(node) {
  // Write your logic for the validation of submission value here and return a boolean value in response

  console.log("Validating Node", node);
  return true;
}

export async function validateDistribution(node) {
  // Write your logic for the validation of submission value here and return a boolean value in response
  // this logic can be same as generation of distribution list function and based on the comparision will final object , decision can be made
  console.log("Validating Node", node);
  return true;
}
// Submit Address with distributioon list to K2
export async function submitTask(roundNumber) {
  console.log("submitTask called with round", roundNumber);
  try {
    console.log("inside try");
    console.log(
      await namespaceWrapper.getSlot(),
      "current slot while calling submit"
    );
    const cid = await fetchSubmission();
    await namespaceWrapper.checkSubmissionAndUpdateRound(cid, roundNumber);
    console.log("after the submission call");
  } catch (error) {
    console.log("error in submission", error);
  }
}

export async function auditTask(roundNumber) {
  console.log("auditTask called with round", roundNumber);
  console.log(
    await namespaceWrapper.getSlot(),
    "current slot while calling auditTask"
  );
  await namespaceWrapper.validateAndVoteOnNodes(validateNode, roundNumber);
}

export async function auditDistribution(roundNumber) {
  console.log("auditDistribution called with round", roundNumber);
  await namespaceWrapper.validateAndVoteOnDistributionList(
    validateDistribution,
    roundNumber
  );
}

// module.exports = {
//   task,
//   submitDistributionList,
//   validateNode,
//   validateDistribution,
//   submitTask,
//   auditTask,
//   auditDistribution,
// };
