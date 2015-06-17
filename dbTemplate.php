<?php
// This class is used for simplifying the handling of database records.  Any
// record can be retreived as an object, it's values manipulated, etc.  Data is
// scrubbed in the dbRecord class to prevent SQL injections when it gets saved.
// tl;dr: It's a simple ORM of sorts
mysql_connect('localhost', 'username', 'password');
mysql_select_db('database');

abstract class dbRecord{
	protected $_data;
	protected $_fields;
	protected $_keys;
	protected $_aliasMap;
	protected $_isNewRecord;

	abstract protected function _initialize();

	function __construct(){
		$this->_initialize();
		$this->_buildAliasMap();
		$this->reset();

		$numArgs = func_num_args();
		$numExpectedArgs = count($this->_keys);
		if($numArgs == $numExpectedArgs){
			$this->load(func_get_args());
		}else if($numArgs != 0){
			$errMsg = get_class($this) . " construct expects $numExpectedArgs parameter" . ($numExpectedArgs == 1 ? '' : 's');
			$errMsg .= " (" . implode(', ', $this->_keys);
			$errMsg .= "), received $numArgs instead";
			throw new Exception($errMsg);
		}
	}

	public function reset(){
		foreach($this->_fields as $fName => $fData){
			$this->_data[$fName] = $fData['default'];
		}
		$this->_isNewRecord = true;
	}

	public function delete(){
		if(!$this->_isNewRecord){
			$query = "DELETE FROM `" . $this->_tableName . "` WHERE ";
			$queryParts = array();
			foreach($this->_keys as $keyField){
				$queryParts[] .= "`$keyField` = '" . $this->_data[$keyField] . "'";
			}
			$query .= implode(', ', $queryParts);
			mysql_query($query);
			if(($err = mysql_error()) != ''){
				throw new Exception("Unable to delete record: $err\nFailed query: $query");
			}
		}
		$this->reset();
	}

	protected function _buildAliasMap(){
		$this->_aliasMap = array();
		foreach($this->_fields as $fName => $fData){
			if(array_key_exists('alias', $fData)){
				$this->_aliasMap[strtolower($fData['alias'])] = $fName;
			}else{
				$this->_aliasMap[strtolower($fName)] = $fName;
			}
		}
	}

	protected function _scrubValue($value, $fieldName){
		$rval = null;
		$canBeNULL = true;
		if(array_key_exists('notnull', $this->_fields[$fieldName])){
			$canBeNULL = ($this->_fields[$fieldName]['notnull'] == false);
		}
		if($canBeNULL && $value === null){
			return $rval;
		}

		switch(strtoupper($this->_fields[$fieldName]['type'])){
			case 'INT': case 'INTEGER':
				$rval = intval($value);
				break;
			case 'FLOAT':
				$rval = floatval($value);
				break;
			case 'BOOLEAN':
				$rval = $value ? 1 : 0;
				break;
			case 'VARCHAR': case 'TEXT': case 'DATE': case 'TIME': case 'DATETIME': case 'TIMESTAMP':
				$rval = mysql_real_escape_string($value);
				break;
			case 'ENUM':
				if(in_array($value, $this->_fields[$fieldName]['values'])){
					$rval = mysql_real_escape_string($value);
				}
				break;
			default:
				$rval = mysql_real_escape_string($value);
		}
		return $rval;
	}

	public function __call($name, $params){
		switch(substr($name, 0, 3)){
			case 'get':
				$name = strtolower(substr($name, 3));
				if(array_key_exists($name, $this->_aliasMap)){
					if(array_key_exists('gethandler', $this->_fields[$this->_aliasMap[$name]])){
						// fixme... This will not handle the case where "gethandler" points to
						// an undefined function.  It may give infinite recursion as a result.
						return $this->{$this->_fields[$this->_aliasMap[$name]]['gethandler']}();
					}else{
						return $this->_data[$this->_aliasMap[$name]];
					}
				}else{
					throw new Exception(get_class($this) . "::get$name: Invalid field name \"$name\"");
				}
				break;
			
			case 'set':
				$name = strtolower(substr($name, 3));
				if(array_key_exists($name, $this->_aliasMap)){
					if(count($params) == 1){
						// if a custom function for handling a set on this variable is defined, then call it
						if(array_key_exists('sethandler', $this->_fields[$this->_aliasMap[$name]])){
							// fixme... This will not handle the case where "sethandler" points to
							// an undefined function.  It may give infinite recursion as a result.
							return $this->{$this->_fields[$this->_aliasMap[$name]]['sethandler']}($params[0]);
						}else{
							// error catching for invalid ENUM assignment
							if($this->_fields[$this->_aliasMap[$name]]['type'] == 'enum'){
								if(!in_array($params[0], $this->_fields[$this->_aliasMap[$name]]['values'])){
									throw new Exception("field $name is an ENUM and expects one of the following values: " . implode(', ', $this->_fields[$this->_aliasMap[$name]]['values']));
								}
							}
							// hey!  If we made it this far, then the value seems valid and we can store it
							$this->_data[$this->_aliasMap[$name]] = $params[0];
							return $params[0];
						}
					}else{
						throw new Exception("function " . get_class($this) . "::set$name expects a single value parameter");
					}
				}else{
					throw new Exception(get_class($this) . "::set$name: Invalid field name \"$name\"");
				}
				break;
		}
	}

	public function save(){
		if($this->_isNewRecord){
			// we're creating a new record
			$query = "INSERT INTO `" . mysql_real_escape_string($this->_tableName) . "`";
			$fieldList = array();
			$valueList = array();
			foreach($this->_fields as $fName => $fStruct){
				// if it's not an auto-increment or the value is not the default for this field, then we insert this field
				if(!array_key_exists('auto', $fStruct) || $this->_data[$fName] != $fStruct['default']){
					$fieldList[] = mysql_real_escape_string($fName);
					$val = $this->_scrubValue($this->_data[$fName], $fName);
					if($val === null){
						$valueList[] = 'NULL';
					}else{
						$valueList[] = "'$val'";
					}
				}
			}
			$query .= " (`" . implode('`, `', $fieldList) . "`)";
			$query .= " VALUES (" . implode(", ", $valueList) . ")";
			mysql_query($query);
			if(($err = mysql_error()) != ''){
				throw new Exception("Unable to create new record: $err");
			}
			// reload
			foreach($this->_fields as $fName => $fStruct){
				if(array_key_exists('auto', $fStruct) && $fStruct['auto'] == true){
					$this->_data[$fName] = mysql_insert_id();
				}
			}
			$this->_isNewRecord = false;
		}else{
			// we're updating an existing record
			$query = "UPDATE " . mysql_real_escape_string($this->_tableName) . " SET ";
			$queryParts = array();
			foreach($this->_fields as $fName => $fStruct){
				// if it's not an auto-increment or the value is not the default for this field, then we insert this field
				if(!array_key_exists('auto', $fStruct) || $this->_data[$fName] != $fStruct['default']){
					$val = $this->_scrubValue($this->_data[$fName], $fName);
					if($val === null){
						$queryParts[] = "`$fName` = NULL";
					}else{
						$queryParts[] = "`$fName` = '" . $this->_scrubValue($this->_data[$fName], $fName) . "'";
					}
				}
			}
			$query .= implode(', ', $queryParts);

			$query .= " WHERE ";
			$queryParts = array();
			foreach($this->_keys as $keyField){
				$queryParts[] .= "`$keyField` = '" . $this->_scrubValue($this->_data[$keyField], $keyField) . "'";
			}
			$query .= implode(', ', $queryParts);
			mysql_query($query);
			if(($err = mysql_error()) != ''){
				throw new Exception("Unable to update record: $err");
			}
		}
	}

	public function load($keyVals){
		for($n = 0; $n < count($this->_keys); $n++){
			$conditions[] = "`" . mysql_real_escape_string($this->_keys[$n]) . "` = '" . $this->_scrubValue($keyVals[$n], $this->_aliasMap[$this->_keys[$n]]) . "'";
		}
		$query = "SELECT * FROM `" . $this->_tableName . "` WHERE " . implode(' AND ', $conditions);
		$row = mysql_fetch_assoc(mysql_query($query));
		if($row){
			$this->_isNewRecord = false;
			foreach($this->_fields as $fName => $fData){
				$this->_data[$fName] = $row[$fName];
			}
		}else{
			$this->reset();
			throw new Exception("Invalid " . implode(', ', $this->_keys) . " value" . (count($this->_keys) > 1 ? 's' : ''));
		}
		return $row != null;
	}

	public function isNewRecord(){
		return $this->_isNewRecord;
	}
}
/** an example table usage **/
/*
class userClass extends dbRecord{
        protected function _initialize(){
                $this->_tableName = 'users';
                $this->_keys = array('id');
                $this->_fields = array(
                        'id' => array(
                                'type' => 'INTEGER',
                                'default' => 0,
                                'auto' => true
                        ),  
                        'username' => array(
                                'type' => 'VARCHAR',
                                'default' => ''
                        ),  
                        'password' => array(
                                'type' => 'VARCHAR',
                                'default' => ''
                        )
                );  
        }   

        public function setPassword($newPassword){
                $this->_data['password'] = crypt($newPassword, $newPassword);
    
        }   

        public static function authenticate($username, $password){
                $user = userClass::retrieveByUsername($username);
                if($user == null) return false;
                return crypt($password, $user->getPassword()) == $user->getPassword();
        }   

        public static function retrieveByUsername($username){
                $rval = null;
                $q = mysql_query("SELECT id FROM `users` WHERE `username` = '" . mysql_real_escape_string($username) . "'");
                if($row = mysql_fetch_assoc($q)){
                        $rval = new userClass($row['id']);
                }   
                return $rval;
        }   
}
*/
