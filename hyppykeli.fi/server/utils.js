const {parse, format} = require("url");
const qs = require("querystring");
const {parseString} = require("xml2js");
const axios = require("axios");

const extendUrlQuery = (url, query) => {
    const o = parse(url, true);
    o.search = qs.stringify(Object.assign({}, o.query, query));

    return format(o);
};

const xml2js = xml => new Promise((resove, reject) => {
    parseString(xml, (err, result) => {
        if (err) {
            reject(err);
        } else {
            resove(result);
        }
    });
});

const fmiRequestCache = {};

const fmiRawRequest = async (url, options) => {
    if (!options) {
        throw new Error("options missing from fmiRawRequest");
    }

    if (!options.cacheAge) {
        options.cacheAge = 30;
    }

    console.log("FMI request", url);

    const existingRequest = fmiRequestCache[options.cacheKey];

    if (existingRequest) {
        await existingRequest.promise;
        const age = Date.now() - existingRequest.created;
        if (age / 1000 < options.cacheAge) {
            console.log("Cache fresh.");
            return existingRequest.promise;
        }

        console.log("Cache expired.");
    } else {
        console.log("No cache.");
    }

    const promise = axios(url)
        .then(res => {
            console.log("FMI request completed", url);
            return xml2js(res.data);
        })
        .catch(error => {
            console.error("FMI request failed", error);
            delete fmiRequestCache[options.cacheKey];
            throw error;
        });

    fmiRequestCache[options.cacheKey] = {
        promise,
        cacheAge: options.cacheAge,
        created: Date.now(),
    };

    return promise;
};

const fmiRequest = ({apikey, query, params, cacheKey, cacheAge}) => {
    const metarURL = `http://data.fmi.fi/fmi-apikey/${apikey}/wfs?request=getFeature`;

    const finalURL = extendUrlQuery(
        metarURL,
        Object.assign(
            {
                storedquery_id: query,
            },
            params
        )
    );

    return fmiRawRequest(finalURL, {cacheKey, cacheAge});
};

module.exports = {
    xml2js,
    fmiRequest,
    fmiRawRequest,
};
