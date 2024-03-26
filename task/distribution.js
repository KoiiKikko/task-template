const { namespaceWrapper } = require('../_koiiNode/koiiNode');
const { createHash } = require('crypto');

class Distribution {
  async submitDistributionList(round) {
    // This function just upload your generated distribution List and do the transaction for that

    console.log('SubmitDistributionList called');

    try {
      const distributionList = await this.generateDistributionList(round);

      const decider = await namespaceWrapper.uploadDistributionList(
        distributionList,
        round,
      );
      console.log('DECIDER', decider);

      if (decider) {
        const response =
          await namespaceWrapper.distributionListSubmissionOnChain(round);
        console.log('RESPONSE FROM DISTRIBUTION LIST', response);
      }
    } catch (err) {
      console.log('ERROR IN SUBMIT DISTRIBUTION', err);
    }
  }

  async auditDistribution(roundNumber) {
    console.log('auditDistribution called with round', roundNumber);
    await namespaceWrapper.validateAndVoteOnDistributionList(
      this.validateDistribution,
      roundNumber,
    );
  }

  async generateDistributionList(round, _dummyTaskState) {
    try {
      console.log('GenerateDistributionList called');
      console.log('I am selected node');

      // Write the logic to generate the distribution list here by introducing the rules of your choice

      /*  **** SAMPLE LOGIC FOR GENERATING DISTRIBUTION LIST ******/

      let distributionList = {};
      let distributionCandidates = [];
      let taskAccountDataJSON = await namespaceWrapper.getTaskState();
      if (taskAccountDataJSON == null) taskAccountDataJSON = _dummyTaskState;
      const submissions = taskAccountDataJSON.submissions[round];
      const submissions_audit_trigger =
        taskAccountDataJSON.submissions_audit_trigger[round];
      if (submissions == null) {
        console.log(`No submissions found in round ${round}`);
        return distributionList;
      } else {
        const keys = Object.keys(submissions);
        const values = Object.values(submissions);
        const size = values.length;
        console.log('Submissions from last round: ', keys, values, size);

        // Logic for slashing the stake of the candidate who has been audited and found to be false
        for (let i = 0; i < size; i++) {
          const candidatePublicKey = keys[i];
          if (
            submissions_audit_trigger &&
            submissions_audit_trigger[candidatePublicKey]
          ) {
            console.log(
              'distributions_audit_trigger votes ',
              submissions_audit_trigger[candidatePublicKey].votes,
            );
            const votes = submissions_audit_trigger[candidatePublicKey].votes;
            if (votes.length === 0) {
              // slash 70% of the stake as still the audit is triggered but no votes are casted
              // Note that the votes are on the basis of the submission value
              // to do so we need to fetch the stakes of the candidate from the task state
              const stake_list = taskAccountDataJSON.stake_list;
              const candidateStake = stake_list[candidatePublicKey];
              const slashedStake = candidateStake * 0.7;
              distributionList[candidatePublicKey] = -slashedStake;
              console.log('Candidate Stake', candidateStake);
            } else {
              let numOfVotes = 0;
              for (let index = 0; index < votes.length; index++) {
                if (votes[index].is_valid) numOfVotes++;
                else numOfVotes--;
              }

              if (numOfVotes < 0) {
                // slash 70% of the stake as the number of false votes are more than the number of true votes
                // Note that the votes are on the basis of the submission value
                // to do so we need to fetch the stakes of the candidate from the task state
                const stake_list = taskAccountDataJSON.stake_list;
                const candidateStake = stake_list[candidatePublicKey];
                const slashedStake = candidateStake * 0.7;
                distributionList[candidatePublicKey] = -slashedStake;
                console.log('Candidate Stake', candidateStake);
              }

              if (numOfVotes > 0) {
                distributionCandidates.push(candidatePublicKey);
              }
            }
          } else {
            distributionCandidates.push(candidatePublicKey);
          }
        }
      }

      // now distribute the rewards based on the valid submissions
      // Here it is assumed that all the nodes doing valid submission gets the same reward

      const reward = Math.floor(
        taskAccountDataJSON.bounty_amount_per_round /
          distributionCandidates.length,
      );
      console.log('REWARD RECEIVED BY EACH NODE', reward);
      for (let i = 0; i < distributionCandidates.length; i++) {
        distributionList[distributionCandidates[i]] = reward;
      }
      console.log('Distribution List', distributionList);
      return distributionList;
    } catch (err) {
      console.log('ERROR IN GENERATING DISTRIBUTION LIST', err);
    }
  }

  validateDistribution = async (
    distributionListSubmitter,
    round,
    _dummyDistributionList,
    _dummyTaskState,
  ) => {
    // Write your logic for the validation of submission value here and return a boolean value in response
    // this logic can be same as generation of distribution list function and based on the comparison will final object , decision can be made

    try {
      console.log('Distribution list Submitter', distributionListSubmitter);
      const rawDistributionList = await namespaceWrapper.getDistributionList(
        distributionListSubmitter,
        round,
      );
      let fetchedDistributionList;
      if (rawDistributionList == null) {
        fetchedDistributionList = _dummyDistributionList;
      } else {
        fetchedDistributionList = JSON.parse(rawDistributionList);
      }
      console.log('FETCHED DISTRIBUTION LIST', fetchedDistributionList);
      const generateDistributionList = await this.generateDistributionList(
        round,
        _dummyTaskState,
      );

      // compare distribution list

      const parsed = fetchedDistributionList;
      console.log(
        'compare distribution list',
        parsed,
        generateDistributionList,
      );
      const result = await this.shallowEqual(parsed, generateDistributionList);
      console.log('RESULT', result);
      return result;
    } catch (err) {
      console.log('ERROR IN VALIDATING DISTRIBUTION', err);
      return false;
    }
  };

  async nodeSelectionDistributionList(round, isPreviousFailed = false) {
    const taskAccountDataJSON = await namespaceWrapper.getTaskState();
    console.log('EXPECTED ROUND', round);

    const submissions = taskAccountDataJSON.submissions[round];
    if (submissions == null) {
      console.log('No submisssions found in N-1 round');
      return 'No submisssions found in N-1 round';
    } else {
      const values = Object.values(submissions);
      console.log('VALUES', values);
      const keys = Object.keys(submissions);
      console.log('KEYS', keys);
      let size = values.length;
      console.log('Submissions from N-2  round: ', keys, values, size);

      // Check the keys i.e if the submitter shall be excluded or not

      const audit_record = taskAccountDataJSON.distributions_audit_record;
      console.log('AUDIT RECORD');
      console.log('ROUND DATA', audit_record[round]);

      if (audit_record[round] == 'PayoutFailed') {
        console.log(
          'SUBMITTER LIST',
          taskAccountDataJSON.distribution_rewards_submission[round],
        );
        const submitterList =
          taskAccountDataJSON.distribution_rewards_submission[round];
        const submitterSize = Object.keys(submitterList).length;
        console.log('SUBMITTER SIZE', submitterSize);
        const submitterKeys = Object.keys(submitterList);
        console.log('SUBMITTER KEYS', submitterKeys);

        for (let j = 0; j < submitterSize; j++) {
          console.log('SUBMITTER KEY CANDIDATE', submitterKeys[j]);
          const id = keys.indexOf(submitterKeys[j]);
          console.log('ID', id);
          keys.splice(id, 1);
          values.splice(id, 1);
          size--;
        }

        console.log('KEYS', keys);
      }

      // calculating the digest

      const ValuesString = JSON.stringify(values);

      const hashDigest = createHash('sha256')
        .update(ValuesString)
        .digest('hex');

      console.log('HASH DIGEST', hashDigest);

      // function to calculate the score
      const calculateScore = (str = '') => {
        return str.split('').reduce((acc, val) => {
          return acc + val.charCodeAt(0);
        }, 0);
      };

      // function to compare the ASCII values

      const compareASCII = (str1, str2) => {
        const firstScore = calculateScore(str1);
        const secondScore = calculateScore(str2);
        return Math.abs(firstScore - secondScore);
      };

      // loop through the keys and select the one with higest score

      const selectedNode = {
        score: 0,
        pubkey: '',
      };
      let score = 0;
      if (isPreviousFailed) {
        let leastScore = -Infinity;
        let secondLeastScore = -Infinity;
        for (let i = 0; i < size; i++) {
          const candidateSubmissionJson = {};
          candidateSubmissionJson[keys[i]] = values[i];
          const candidateSubmissionString = JSON.stringify(
            candidateSubmissionJson,
          );
          const candidateSubmissionHash = createHash('sha256')
            .update(candidateSubmissionString)
            .digest('hex');
          const candidateScore = compareASCII(
            hashDigest,
            candidateSubmissionHash,
          );
          if (candidateScore > leastScore) {
            secondLeastScore = leastScore;
            leastScore = candidateScore;
          } else if (candidateScore > secondLeastScore) {
            secondLeastScore = candidateScore;
            selectedNode.score = candidateScore;
            selectedNode.pubkey = keys[i];
          }
        }
      } else {
        for (let i = 0; i < size; i++) {
          const candidateSubmissionJson = {};
          candidateSubmissionJson[keys[i]] = values[i];
          const candidateSubmissionString = JSON.stringify(
            candidateSubmissionJson,
          );
          const candidateSubmissionHash = createHash('sha256')
            .update(candidateSubmissionString)
            .digest('hex');
          const candidateScore = compareASCII(
            hashDigest,
            candidateSubmissionHash,
          );
          console.log('CANDIDATE SCORE', candidateScore);
          if (candidateScore > score) {
            score = candidateScore;
            selectedNode.score = candidateScore;
            selectedNode.pubkey = keys[i];
          }
        }
      }

      console.log('SELECTED NODE OBJECT', selectedNode);
      return selectedNode.pubkey;
    }
  }

  async shallowEqual(parsed, generateDistributionList) {
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }

    // Normalize key quote usage for generateDistributionList
    generateDistributionList = JSON.parse(
      JSON.stringify(generateDistributionList),
    );

    const keys1 = Object.keys(parsed);
    const keys2 = Object.keys(generateDistributionList);
    if (keys1.length !== keys2.length) {
      return false;
    }

    for (let key of keys1) {
      if (parsed[key] !== generateDistributionList[key]) {
        return false;
      }
    }
    return true;
  }
}

const distribution = new Distribution();
module.exports = {
  distribution,
};
