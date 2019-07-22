const platformClient = require('platformClient');

const client = platformClient.ApiClient.instance;

const clientId = 'e7de8a75-62bb-43eb-9063-38509f8c21af';
const redirectUri = 'http://localhost:8080/index.html';

const usersApi = new platformClient.UsersApi();
const analyticsApi = new platformClient.AnalyticsApi();

const userIds = [
    "8efbfaef-cff8-4fb4-8b61-980c2cad778f",
    "e23504da-f6e4-41e5-9ed8-0b81808a0d01",
    "2f487b21-3dcb-4e90-b2b2-d00e01332e1c",
    "85c95a1f-fdbf-4e66-9c4d-c58475b3b0f3"
];

const today = new Date();
const firstDate = new Date();
firstDate.setDate(today.getDate() - 7);

const todayISO = today.toISOString();
const firstDateISO = firstDate.toISOString();

// Create body that's used by pretty much all aggregate queries
const bodyForAggregates = {
    interval: `${firstDateISO}/${todayISO}`,
    groupBy: ['userId'],
    filter: {
        type: "or",
        predicates: userIds.map(userId => ({
            "type": "dimension",
            "dimension": "userId",
            "operator": "matches",
            "value": userId
        }))
    },
    "metrics": [],
    "flattenMultivaluedDimensions": true
}

let players = {}
// FORMAT:
// "playerId": {
//     "image": "",
//     "stats": {
//         "acw": 0,
//         "aht": 0,
//         "surveyScore": 0,
//         "qaScore": 0
//     }
// }

// Authenticate with PureCloud
client.loginImplicitGrant(clientId, redirectUri)
    .then((data) => {
        console.log(userIds);

        // Get PureCloud users info
        return Promise.all(userIds.map(userId => usersApi.getUser(userId)));
    })
    // Fill the player data with key + imageUri
    .then((users) => {
        users.forEach(user => {
            players[user.id] = {
                "image": user.images[5].imageUri,
                "stats": {
                    "acw": null,
                    "aht": null,
                    "surveyScore": null,
                    "qaScore": null
                }
            };
        })

        // Get Conversation data for users
        return analyticsApi.postAnalyticsConversationsAggregatesQuery(bodyForAggregates);
    })
    // Assign AHT and ACW averages to Players object
    .then((data) => {
        console.log(data);
        userIds.forEach(userId => {
            let matchingResult = data.results.find(d =>
                userId == d.group.userId).data[0];

            let ahtMetric = matchingResult.metrics.find(
                metric => metric.metric == 'tHandle').stats;
            let acwMetric = matchingResult.metrics.find(
                metric => metric.metric == 'tAcw').stats;

            players[userId].stats.aht = Math.floor(ahtMetric.sum / ahtMetric.count);
            players[userId].stats.acw = Math.floor(acwMetric.sum / acwMetric.count);
        })

        return analyticsApi.postAnalyticsEvaluationsAggregatesQuery(bodyForAggregates);
    })
    .then((data) => {
        console.log(data);
        userIds.forEach(userId => {
            let matchingResult = data.results.find(d =>
                userId == d.group.userId).data[0];

            let qaScoreMetric = matchingResult.metrics.find(
                metric => metric.metric == 'oTotalScore').stats;

            players[userId].stats.qaScore =
                Math.floor(qaScoreMetric.sum / qaScoreMetric.count);
        });

        return analyticsApi.postAnalyticsSurveysAggregatesQuery(bodyForAggregates);
    })


    .then((data) => {

        console.log(data);
        userIds.forEach(userId => {
            let matchingResult = data.results.find(d =>
                userId == d.group.userId).data[0];

            let surveyScoreMetric = matchingResult.metrics.find(
                metric => metric.metric == 'oSurveyTotalScore').stats;

            players[userId].stats.surveyScore =
                Math.floor(surveyScoreMetric.sum / surveyScoreMetric.count);
        });



        console.log(players);
        console.log("DONE");





        getImage();

    })
    .catch((err) => {
        console.log(err);
    });
