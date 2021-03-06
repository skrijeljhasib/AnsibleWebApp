<?php
/**
 * Created by PhpStorm.
 * User: skrijeljhasib
 * Date: 18.05.17
 * Time: 19:23
 */

namespace Project\Cli;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Psr7;
use ObjectivePHP\Application\ApplicationInterface;
use ObjectivePHP\Cli\Action\AbstractCliAction;
use Pheanstalk\Pheanstalk;
use Project\Config\Url;

/**
 * Class PostWorker
 * @package Project\Cli
 */
class PostWorker extends AbstractCliAction
{

    public function __construct()
    {
        $this->setCommand('post-worker');
        $this->setDescription('Send JSON String as a POST Request to AnsibleApi');
    }

    public function run(ApplicationInterface $app)
    {
        $url = $app->getConfig()->get(Url::class);

        $pheanstalk = new Pheanstalk($url['beanstalk']);

        while (true) {
            $job = $pheanstalk
                ->watch('getallmachine')
                ->watch('deletemachine')
                ->watch('ansible-post')
                ->watch('installmachine')
                ->ignore('default')
                ->reserve();

            if ($job !== false) {

                $guzzle_client = new Client(
                    [
                        'base_uri' => $url["ansible_api"],
                        'headers' => [
                            'Content-Type' => 'application/json'
                        ]
                    ]
                );
                try {
                    $callback['progress'] = "0";
                    $callback['task'] = json_decode($job->getData(), true)['name'];
                    $websocket_client = new \Hoa\Websocket\Client(
                        new \Hoa\Socket\Client($url['websocket_client'])
                    );
                    $websocket_client->setHost(gethostname());
                    $websocket_client->connect();
                    $websocket_client->send(json_encode($callback));
                    $websocket_client->close();

                    $response = $guzzle_client->request('POST', '/post_data',
                        [
                            'json' => json_decode($job->getData())
                        ]
                    );

                    if ($response->getStatusCode() == 200) {
                        $callback['progress'] = "100";
                        $callback['task'] = json_decode($job->getData(), true)['name'];
                        $websocket_client = new \Hoa\Websocket\Client(
                            new \Hoa\Socket\Client($url['websocket_client'])
                        );
                        $websocket_client->setHost(gethostname());
                        $websocket_client->connect();
                        $websocket_client->send(json_encode($callback));
                        $websocket_client->close();

                        $pheanstalk->useTube('ansible-get-' . $pheanstalk->statsJob($job)['tube'])->put($response->getBody());
                        $pheanstalk->delete($job);
                    } else {
                        echo 'Request failed: HTTP status code: ' . $response->getStatusCode();
                        $pheanstalk->bury($job);
                    }
                } catch (RequestException $e) {
                    echo Psr7\str($e->getRequest());
                    if ($e->hasResponse()) {
                        echo Psr7\str($e->getResponse());
                    }
                }

            } else {
                echo 'waiting...';
                sleep(3);
            }
        }
    }
}
