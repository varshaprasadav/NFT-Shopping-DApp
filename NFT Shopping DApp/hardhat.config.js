require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {

    solidity: {
        version: "0.8.23",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },

    networks: {

        hoodi: {
            url:
                process.env.HOODI_RPC_URL ||
                "",

            accounts:
                process.env.DEPLOYER_PRIVATE_KEY
                    ? [process.env.DEPLOYER_PRIVATE_KEY]
                    : []
        }
    }
};
