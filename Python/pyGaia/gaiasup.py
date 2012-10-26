# coding: utf-8

import json
import urllib, urllib2, cookielib

API_HOST = 'http://api.gaiasup.com'

class GaiaSup:
  #----------------------------------------
  def __init__(self):
    # Cookie handle
    self.cj = cookielib.CookieJar()
    self.opener = urllib2.build_opener(urllib2.HTTPCookieProcessor(self.cj))
    urllib2.install_opener(self.opener)

  #----------------------------------------
  def _postReq(self, url, param = ''):
    print '\n= URL: ' + url
    req = urllib2.Request(url, param)
    try:
      ret = json.loads(self.opener.open(req).read())
    except:
      ret = 'JSON_PARSE_ERROR'

    return ret

  #----------------------------------------
  def _getReq(self, url):
    print '\n= URL: ' + url
    res = self.opener.open(url)
    try:
      ret = json.loads(res.read())
    except:
      ret = 'JSON_PARSE_ERROR'

    return ret

  #----------------------------------------
  def publishPos(self, x, y, z):
    """Publish self position for other Nodes to see."""
    retPubPos = self._postReq(API_HOST + '/publish/pos/' + str(x) + '/' + str(y) + '/' + str(z))
    if retPubPos[0] == 'OK':
      return 'OK'
    else:
      return 'PUBLISH_POS_FAILED: ' + str(retPubPos)

  #----------------------------------------
  def querySquare(self, xmin, ymin, zmin, xmax, ymax, zmax):
    """Obtain the positions of other Nodes within a square area."""
    retQuerySqr = self._getReq(API_HOST + '/query/square/' + str(xmin) + '/' + str(ymin) + '/' + str(zmin) + '/' + str(xmax) + '/' + str(ymax) + '/' + str(zmax))

    return retQuerySqr

  #----------------------------------------
  def queryNode(self, queryData, apiKey = '', layerName = '', identName = ''):
    """Obtain the information of one or a list of Nodes."""
    if queryData:
      retQueryNode = self._postReq(API_HOST + '/query/nodes', queryData)
    else:
      retQueryNode = self._getReq(API_HOST + '/query/node/' + str(apiKey) + '/' + str(layerName) + '/' + urllib.quote(str(identName)))

    return retQueryNode

  #----------------------------------------
  def subscribeNode(self, targetData, apiKey = '', layerName = '', identName = ''):
    """Obtain the information of one or a list of Nodes."""
    if targetData:
      retSubNode = self._postReq(API_HOST + '/subscribe/nodes', targetData)
    else:
      retSubNode = self._getReq(API_HOST + '/subscribe/node/' + str(apiKey) + '/' + str(layerName) + '/' + urllib.quote(str(identName)))

    return retSubNode

  #----------------------------------------
  def getSubscribers(self, apiKey = '', layerName = '', identName = ''):
    """Get the list of subscribers to the current or another specified Node."""
    if apiKey and layerName and identName:
      retGetSuber = self._getReq(API_HOST + '/subscribers/' + str(apiKey) + '/' + str(layerName) + '/' + urllib.quote(str(identName)))
    else:
      retGetSuber = self._getReq(API_HOST + '/subscribers')

    return retGetSuber

  #----------------------------------------
  def sendMessage(self, sendData, apiKey = '', layerName = '', identName = ''):
    """Send message to a node or some nodes at once."""
    print '=== ' + json.dumps(sendData)
    if apiKey and layerName and identName:
      retSendMsg = self._postReq(API_HOST + '/msg/send/' + str(apiKey) + '/' + str(layerName) + '/' + urllib.quote(str(identName)), sendData)
    else:
      #retSendMsg = self._postReq(API_HOST + '/msg/send', sendData)
      print '\n= URL: ' + API_HOST + '/msg/send'
      req = urllib2.Request(API_HOST + '/msg/send', sendData)
      retSendMsg = '===retSendMsg: ' + str(json.loads(self.opener.open(req).read()))

    return retSendMsg

  #----------------------------------------
  def receiveMessage(self):
    """Receive new messages."""
    retRecvMsg = self._getReq(API_HOST + '/msg/recv')
    print retRecvMsg

    return retRecvMsg.encode('utf-8', 'ignore')

  #----------------------------------------
  def queryMessage(self, startTime, stopTime):
    """Query from message history."""
    retQueryMsg = self._getReq(API_HOST + '/msg/query/' + str(startTime) + '/' + str(stopTime))

    return retQueryMsg

  #----------------------------------------
  def registerLayer(self, apiKey, layerName):
    """Register a Layer under a given API key. Returns OK on success or already exist."""
    retRegLayer = self._getReq(API_HOST + '/register/' + str(apiKey) + '/' + str(layerName))

    return retRegLayer

  #----------------------------------------
  def registerNode(self, apiKey, layerName, identName):
    """Register a Node under a given API key and Layer. Returns OK on success or if already exist."""
    retRegNode = self._getReq(API_HOST + '/register/' + str(apiKey) + '/' + str(layerName) + '/' + urllib.quote(str(identName)))

    return retRegNode

  #----------------------------------------
  def validNode(self, apiKey, layerName, identName):
    """Validate whether a particular Node is registered."""
    retValid = self._getReq(API_HOST + '/valid/' + str(apiKey) + '/' + str(layerName) + '/' + urllib.quote(str(identName)))

    return retValid

  #----------------------------------------
  def revokeLayer(self, apiKey, layerName):
    """Revoke a currently existing Layer."""
    retRevokeLayer = self._getReq(API_HOST + '/revoke/' + str(apiKey) + '/' + str(layerName))

    return retRevokeLayer

  #----------------------------------------
  def revokeNode(self):
    """Revoke a currently existing Node."""
    retRevokeNode = self._getReq(API_HOST + '/revoke/node')

    return retRevokeNode

  #----------------------------------------
  def join(self, apiKey, layerName, identName):
    """Check node and layer, register them if result is valid"""
    self.apiKey = str(apiKey)
    self.layerName = str(layerName)
    self.identName = str(identName)

    retValid = self.validNode(self.apiKey, self.layerName, self.identName)
    if retValid[0] != 'OK':
      retRegLayer = self.registerLayer(self.apiKey, self.layerName)
      if retRegLayer[0] == 'OK':
        retRegNode = self.registerNode(self.apiKey, self.layerName, self.identName)
        if retRegNode[0] != 'OK':
          return 'REGISTER_NODE_FAILED: ' + str(retRegNode)
        else:
          return 'INIT_OK'
      else:
        return 'REGISTER_LAYER_FAILED: ' + str(retRegLayer)
    else:
      return 'NODE_ALREADY_EXIST: ' + str(retValid)


if __name__ == '__main__':
  pass
